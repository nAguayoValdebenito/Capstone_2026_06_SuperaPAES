// TEC-08.2 y CP-53: restaurar una copia cifrada del respaldo en una base aparte y vacía, con las mismas
// cantidades que la base respaldada. Se niega con un destino que no está vacío, con el destino igual a la
// base publicada (URL_PRODUCCION o DATABASE_URL) y sin ninguna base con qué compararlo. Solo bases _test.
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ErrorOperacion } from '../db/procesos.js';
import { type CopiaCifrada, contarDatos, respaldar } from '../db/copia-de-respaldo.js';
import { exigirDestinoDistinto, mismaBase, restaurarRespaldo } from '../db/restauracion.js';
import {
  type BaseTemporal,
  crearBaseTemporal,
  exigirBaseEnCi,
  MINUTO,
  urlBase,
} from './base-temporal.js';
import {
  CLAVE_DE_PRUEBA,
  crearEstudiante,
  crearPractica,
  crearSuscripcion,
  prepararContenido,
} from './datos-contingencia.js';

// Direcciones inventadas, sin servidores reales. secretlint-disable-next-line
const PUBLICADA = 'postgres://u:c@ep-publicada.example.cl/neondb';
// secretlint-disable-next-line
const OTRA_RAMA = 'postgres://u:c@ep-otra-rama.example.cl/neondb';

describe('destino de la restauración (sin base)', () => {
  it('compara servidor, puerto y nombre de la base', () => {
    expect(mismaBase(PUBLICADA, 'postgres://otro:x@EP-PUBLICADA.example.cl:5432/neondb')).toBe(
      true,
    );
    expect(mismaBase(PUBLICADA, OTRA_RAMA)).toBe(false);
    expect(mismaBase(PUBLICADA, 'postgres://u:c@ep-publicada.example.cl:5433/neondb')).toBe(false);
  });

  it('se niega si el destino es la base publicada o la de DATABASE_URL', () => {
    expect(() =>
      exigirDestinoDistinto(PUBLICADA, { URL_PRODUCCION: PUBLICADA, DATABASE_URL: undefined }),
    ).toThrow('URL_DESTINO es la misma base que URL_PRODUCCION');
    expect(() =>
      exigirDestinoDistinto(PUBLICADA, { URL_PRODUCCION: OTRA_RAMA, DATABASE_URL: PUBLICADA }),
    ).toThrow('misma base que DATABASE_URL');
  });

  it('se niega si no hay ninguna base con qué comparar', () => {
    expect(() =>
      exigirDestinoDistinto(OTRA_RAMA, { URL_PRODUCCION: undefined, DATABASE_URL: '' }),
    ).toThrow('No hay con qué comparar el destino');
  });

  it('acepta otra base y rechaza una dirección inválida', () => {
    expect(() => exigirDestinoDistinto(OTRA_RAMA, { URL_PRODUCCION: PUBLICADA })).not.toThrow();
    expect(() => exigirDestinoDistinto('no-es-url', { URL_PRODUCCION: PUBLICADA })).toThrow(
      'URL_DESTINO no es una dirección',
    );
  });
});

exigirBaseEnCi();
describe.skipIf(!urlBase)('restauración del respaldo diario (CP-53)', () => {
  let origen: BaseTemporal;
  let carpeta: string;
  let copia: CopiaCifrada;

  beforeAll(async () => {
    origen = await crearBaseTemporal('restaurar_origen');
    carpeta = await mkdtemp(path.join(tmpdir(), 'copias-'));
    const preguntas = await prepararContenido(origen.bd);
    const estudianteId = await crearEstudiante(origen.bd, 'restaurar@ejemplo.cl');
    await crearPractica(origen.bd, {
      estudianteId,
      preguntas,
      letras: ['A', 'A', 'B', null, 'A'],
      cierre: 'entregada',
    });
    await crearSuscripcion(origen.bd, estudianteId);
    copia = await respaldar({
      conexion: { url: origen.url, ssl: false },
      clave: CLAVE_DE_PRUEBA,
      carpeta,
      fecha: new Date(),
    });
  }, MINUTO);

  afterAll(async () => {
    await rm(carpeta, { recursive: true, force: true });
    await origen.cerrar();
  });

  const restaurarEn = (
    destino: string,
    referencias: Record<string, string | undefined> = { URL_PRODUCCION: origen.url },
  ) =>
    restaurarRespaldo({
      archivo: copia.respaldo,
      archivoCantidades: copia.cantidades,
      clave: CLAVE_DE_PRUEBA,
      destino: { url: destino, ssl: false },
      referencias,
    });

  it(
    'restaura en una base vacía con las mismas cantidades que la base respaldada',
    async () => {
      const destino = await crearBaseTemporal('restaurar_destino', { migrar: false });
      try {
        const { restauradas, respaldo } = await restaurarEn(destino.url);
        expect(restauradas).toEqual(await contarDatos(origen.bd));
        expect(respaldo?.cantidades).toEqual(restauradas);
        expect(restauradas).toMatchObject({
          estudiantes: 1,
          preguntasPublicadas: 5,
          evaluaciones: 1,
          respuestas: 4,
          suscripciones: 1,
        });
        // La base restaurada conserva sus reglas: la evaluación cerrada no se puede modificar.
        await expect(
          destino.bd.query('UPDATE app.evaluacion SET cantidad_preguntas = 6 WHERE true'),
        ).rejects.toThrow('Una evaluación cerrada no se modifica');
      } finally {
        await destino.cerrar();
      }
    },
    MINUTO,
  );

  it(
    'se niega a restaurar en una base que no está vacía, sin tocarla',
    async () => {
      const ocupada = await crearBaseTemporal('restaurar_ocupada');
      try {
        await expect(restaurarEn(ocupada.url)).rejects.toThrow('La base de destino no está vacía');
        expect((await contarDatos(ocupada.bd)).preguntasPublicadas).toBe(0);
      } finally {
        await ocupada.cerrar();
      }
    },
    MINUTO,
  );

  it('se niega si el destino es la base publicada, antes de conectarse', async () => {
    await expect(restaurarEn(origen.url)).rejects.toThrow(ErrorOperacion);
    await expect(
      restaurarEn(origen.url, { URL_PRODUCCION: undefined, DATABASE_URL: origen.url }),
    ).rejects.toThrow('misma base que DATABASE_URL');
    expect((await contarDatos(origen.bd)).evaluaciones).toBe(1);
  });
});
