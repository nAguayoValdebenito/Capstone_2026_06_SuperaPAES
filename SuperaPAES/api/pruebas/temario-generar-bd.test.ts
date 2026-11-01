// HU-16.2: lo que el generador necesita del temario para armar la instrucción de una pregunta: el contenido
// con sus descriptores, su curso, su eje y la prueba con sus habilidades. Con las semillas reales.
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { crearServicios } from '../app.js';
import { ejecutarSemillas } from '../db/semillas.js';
import { crearDependenciasDePrueba } from './ayudantes.js';
import { crearBaseTemporal, exigirBaseEnCi, MINUTO, urlBase } from './base-temporal.js';

describe('contenido para generar sin base', () => {
  exigirBaseEnCi();
});

describe.skipIf(!urlBase)('contenido para generar con PostgreSQL', () => {
  let base: Awaited<ReturnType<typeof crearBaseTemporal>>;
  let temario: ReturnType<typeof crearServicios>['temario'];
  beforeAll(async () => {
    base = await crearBaseTemporal('temario_generar');
    await ejecutarSemillas(base.bd, path.join(import.meta.dirname, '../db/semillas'));
    temario = crearServicios(crearDependenciasDePrueba({ bd: base.bd })).temario;
  }, MINUTO);
  afterAll(async () => {
    await base.cerrar();
  }, MINUTO);

  async function idDeContenido(prueba: string, nombre: string): Promise<number> {
    const { rows } = await base.bd.query<{ id: number }>(
      `SELECT c.id FROM contenido.contenido_tematico c
         JOIN contenido.prueba p ON p.id = c.prueba_id
        WHERE p.codigo = $1 AND c.nombre = $2`,
      [prueba, nombre],
    );
    return rows[0]!.id;
  }

  it('entrega el contenido de M1 con sus descriptores, su eje y la prueba', async () => {
    const id = await idDeContenido('M1', 'Ecuaciones e inecuaciones de primer grado');

    const contenido = await temario.contenidoParaGenerar(id);

    expect(contenido).toMatchObject({
      contenidoId: id,
      nombre: 'Ecuaciones e inecuaciones de primer grado',
      activo: true,
      prueba: { codigo: 'M1', opcionesMax: 4, requiereTexto: false },
    });
    expect(contenido?.descriptores).toContain('Resolución de ecuaciones lineales');
    expect(contenido?.eje.nombre).toBeTruthy();
    expect(contenido?.curso).toBeTruthy();
  });

  it('trae las habilidades de la prueba con su código, nombre y criterios', async () => {
    const id = await idDeContenido('M1', 'Ecuaciones e inecuaciones de primer grado');

    const contenido = await temario.contenidoParaGenerar(id);

    expect(contenido?.prueba.habilidades.map((h) => h.codigo)).toEqual(['ARG', 'MOD', 'REP', 'RP']);
    expect(contenido?.prueba.habilidades.find((h) => h.codigo === 'RP')).toMatchObject({
      nombre: 'Resolver problemas',
    });
    expect(contenido?.prueba.habilidades.every((h) => h.id > 0)).toBe(true);
  });

  it('indica los tipos de pregunta que admite la prueba', async () => {
    const id = await idDeContenido('M1', 'Ecuaciones e inecuaciones de primer grado');

    const contenido = await temario.contenidoParaGenerar(id);

    expect(contenido?.prueba.tiposPregunta).toContain('seleccion_multiple');
  });

  it('Competencia Lectora exige texto y lleva Localizar, Interpretar y Evaluar', async () => {
    const { rows } = await base.bd.query<{ id: number }>(
      `SELECT c.id FROM contenido.contenido_tematico c JOIN contenido.prueba p ON p.id = c.prueba_id
        WHERE p.codigo = 'CL' ORDER BY c.id LIMIT 1`,
    );

    const contenido = await temario.contenidoParaGenerar(rows[0]!.id);

    expect(contenido?.prueba).toMatchObject({ codigo: 'CL', requiereTexto: true, opcionesMax: 4 });
    expect(contenido?.prueba.habilidades.map((h) => h.codigo).sort()).toEqual([
      'EVA',
      'INT',
      'LOC',
    ]);
  });

  it('un contenido que no existe devuelve null', async () => {
    expect(await temario.contenidoParaGenerar(2_000_000_000)).toBeNull();
  });

  it('cantidad de alternativas que fija cada prueba (RN-08), según las semillas', async () => {
    const { rows } = await base.bd.query<{ codigo: string; min: number; max: number }>(
      'SELECT codigo, opciones_min AS min, opciones_max AS max FROM contenido.prueba ORDER BY codigo',
    );

    expect(rows).toEqual([
      { codigo: 'CIE', min: 4, max: 5 },
      { codigo: 'CL', min: 4, max: 4 },
      { codigo: 'HCS', min: 4, max: 4 },
      { codigo: 'M1', min: 4, max: 4 },
      { codigo: 'M2', min: 4, max: 5 },
    ]);
  });
});
