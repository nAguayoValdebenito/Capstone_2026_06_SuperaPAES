// TEC-08.1: respaldo diario cifrado contra una base temporal _test (nunca una base remota). Comprueba
// el volcado, las cantidades cifradas, que sin la clave correcta o con la copia alterada no se puede leer
// (CP-53, paso 2) y que un error no muestra la dirección de la base ni la clave.
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { descifrarArchivo } from '../db/cifrado.js';
import { ErrorOperacion } from '../db/procesos.js';
import { contarDatos, respaldar, verificarVolcado } from '../db/copia-de-respaldo.js';
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
  prepararContenido,
} from './datos-contingencia.js';

// Dirección inventada: el servidor no existe.
const URL_INEXISTENTE =
  // secretlint-disable-next-line
  'postgres://usuario_oculto:clave_oculta_987@servidor-oculto.invalid:5432/base_oculta';
const PARTES_SECRETAS = [
  'usuario_oculto',
  'clave_oculta_987',
  'servidor-oculto.invalid',
  'base_oculta',
];

exigirBaseEnCi();
describe.skipIf(!urlBase)('respaldo diario cifrado (TEC-08.1)', () => {
  let base: BaseTemporal;
  let carpeta: string;

  beforeAll(async () => {
    base = await crearBaseTemporal('respaldo');
    carpeta = await mkdtemp(path.join(tmpdir(), 'copias-'));
    const preguntas = await prepararContenido(base.bd);
    const estudianteId = await crearEstudiante(base.bd, 'respaldo@ejemplo.cl');
    await crearPractica(base.bd, {
      estudianteId,
      preguntas,
      letras: ['A', 'B', 'A', 'A', 'B'],
      cierre: 'entregada',
    });
  }, MINUTO);

  afterAll(async () => {
    await rm(carpeta, { recursive: true, force: true });
    await base.cerrar();
  });

  const respaldarBase = (clave = CLAVE_DE_PRUEBA) =>
    respaldar({
      conexion: { url: base.url, ssl: false },
      clave,
      carpeta,
      fecha: new Date('2026-10-30T07:00:00Z'),
    });

  it(
    'cifra el volcado y las cantidades; con la clave se recuperan iguales a la base',
    async () => {
      const copia = await respaldarBase();
      expect(path.basename(copia.respaldo)).toBe('supera-paes-2026-10-30.dump.gpg');
      expect(copia.bytes).toBeGreaterThan(0);

      const volcado = path.join(carpeta, 'descifrado.dump');
      await descifrarArchivo(copia.respaldo, volcado, CLAVE_DE_PRUEBA);
      await expect(verificarVolcado(volcado)).resolves.toBeUndefined();

      const cantidades = path.join(carpeta, 'cantidades.json');
      await descifrarArchivo(copia.cantidades, cantidades, CLAVE_DE_PRUEBA);
      const guardadas = JSON.parse(await readFile(cantidades, 'utf8')) as Record<string, unknown>;
      expect(guardadas['cantidades']).toEqual(await contarDatos(base.bd));
      expect(guardadas['cantidades']).toMatchObject({
        estudiantes: 1,
        evaluaciones: 1,
        respuestas: 5,
      });
    },
    MINUTO,
  );

  it(
    'CP-53 paso 2: sin la clave correcta, o con la copia alterada, no se puede leer',
    async () => {
      const copia = await respaldarBase();
      const salida = path.join(carpeta, 'intento.dump');
      await expect(
        descifrarArchivo(copia.respaldo, salida, 'otra-clave-de-32-caracteres-o-mas-xx'),
      ).rejects.toThrow('No se pudo descifrar la copia');

      const bytes = await readFile(copia.respaldo);
      bytes[bytes.length - 10] = (bytes[bytes.length - 10] ?? 0) ^ 0xff;
      const alterada = path.join(carpeta, 'alterada.dump.gpg');
      await writeFile(alterada, bytes);
      await expect(descifrarArchivo(alterada, salida, CLAVE_DE_PRUEBA)).rejects.toThrow(
        ErrorOperacion,
      );
    },
    MINUTO,
  );

  it('no respalda con una clave corta', async () => {
    await expect(respaldarBase('corta')).rejects.toThrow('al menos 32');
  });

  it('un volcado vacío hace fallar el respaldo', async () => {
    const vacio = path.join(carpeta, 'vacio.dump');
    await writeFile(vacio, '');
    await expect(verificarVolcado(vacio)).rejects.toThrow('quedó vacío');
  });

  it(
    'si pg_dump falla, el error no trae la dirección de la base ni la clave',
    async () => {
      const error = await respaldar({
        conexion: { url: URL_INEXISTENTE, ssl: false },
        clave: CLAVE_DE_PRUEBA,
        carpeta,
        fecha: new Date(),
      }).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(ErrorOperacion);
      const mensaje = (error as Error).message;
      expect(mensaje).toContain('pg_dump');
      for (const parte of [...PARTES_SECRETAS, CLAVE_DE_PRUEBA])
        expect(mensaje).not.toContain(parte);
    },
    MINUTO,
  );

  it(
    'el comando npm run respaldar falla visible y sin imprimir la dirección ni la clave',
    () => {
      const resultado = spawnSync(
        process.execPath,
        ['--import', 'tsx', path.join(import.meta.dirname, '../db/scripts/respaldar.ts')],
        {
          cwd: path.join(import.meta.dirname, '..'),
          env: {
            ...process.env,
            DATABASE_URL: URL_INEXISTENTE,
            DATABASE_SSL: 'false',
            CLAVE_RESPALDO: CLAVE_DE_PRUEBA,
            CARPETA_RESPALDO: carpeta,
          },
          encoding: 'utf8',
        },
      );
      expect(resultado.status).toBe(1);
      const salida = `${resultado.stdout}${resultado.stderr}`;
      expect(salida).toContain('No se completó la operación');
      for (const parte of [...PARTES_SECRETAS, CLAVE_DE_PRUEBA])
        expect(salida).not.toContain(parte);
    },
    MINUTO,
  );
});
