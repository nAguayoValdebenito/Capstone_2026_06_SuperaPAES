// HU-30 (RF-A06, RN-09, RN-24): opciones para personalizar la práctica (A13 y A14) contra PostgreSQL
// real, con las semillas del temario PAES 2027. Lo esperado se calcula con consultas propias de la
// prueba, no con la del repositorio.
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { exigirBaseEnCi, urlBase } from './base-temporal.js';
import { prepararPerfil } from './perfil-de-prueba.js';

const RUTA = '/api/v1/app/temario/opciones-practica';

interface Eje {
  id: number;
  nombre: string;
  contenidos: { id: number; nombre: string }[];
}
interface Prueba {
  id: number;
  codigo: string;
  ejes: Eje[];
  habilidades: { id: number; nombre: string }[];
}

exigirBaseEnCi();
describe.skipIf(!urlBase)('opciones de práctica con PostgreSQL (HU-30)', () => {
  const p = prepararPerfil('opciones_practica');
  const { entorno } = p;
  let sesion: Record<string, string> = {};

  // La base de sesiones vacía las cuentas antes de cada caso: cada uno abre la suya.
  beforeEach(async () => {
    sesion = (await p.estudianteA(new Date('2026-10-28T15:00:00Z'))).sesion;
  });

  const opciones = (curso?: string) =>
    request(entorno.app)
      .get(RUTA)
      .query(curso === undefined ? {} : { curso })
      .set(sesion);

  async function pruebaDe(curso: string, codigo: string): Promise<Prueba> {
    const respuesta = await opciones(curso);
    expect(respuesta.status).toBe(200);
    const prueba = (respuesta.body.data.pruebas as Prueba[]).find((x) => x.codigo === codigo);
    if (!prueba) throw new Error(`Falta ${codigo} en las opciones.`);
    return prueba;
  }

  const idsDeContenidos = (prueba: Prueba) =>
    prueba.ejes.flatMap((eje) => eje.contenidos.map((c) => c.id)).sort((a, b) => a - b);

  /** Contenidos activos de ejes activos de la prueba que se enseñan hasta ese curso (o sin curso). */
  async function contenidosEsperados(codigo: string, curso: string): Promise<number[]> {
    const { rows } = await entorno.bd.query<{ id: number }>(
      `SELECT c.id FROM contenido.contenido_tematico c
         JOIN contenido.prueba pr ON pr.id = c.prueba_id
         JOIN contenido.eje_tematico e ON e.id = c.eje_id
         LEFT JOIN contenido.nivel_escolar n ON n.id = c.nivel_escolar_id
        WHERE pr.codigo = $1 AND c.activo AND e.activo
          AND (n.id IS NULL OR n.orden <= (SELECT orden FROM contenido.nivel_escolar WHERE codigo = $2))
        ORDER BY c.id`,
      [codigo, curso],
    );
    return rows.map((fila) => fila.id);
  }

  it('las dificultades vienen en orden con su parte de la mezcla equilibrada (RN-09)', async () => {
    const respuesta = await opciones('3M');

    expect(
      (respuesta.body.data.dificultades as { codigo: string; mezcla: number }[]).map((d) => [
        d.codigo,
        d.mezcla,
      ]),
    ).toEqual([
      ['facil', 30],
      ['media', 45],
      ['dificil', 25],
    ]);
  });

  it('en 3° medio no ofrece los contenidos de 4° medio; egresado, todos (RN-24)', async () => {
    const tercero = await pruebaDe('3M', 'M2');
    const egresado = await pruebaDe('EG', 'M2');
    const deCuarto = await contenidosEsperados('M2', '4M');
    const hastaTercero = await contenidosEsperados('M2', '3M');

    // La semilla tiene contenidos de M2 que se enseñan en 4° medio: si no, el caso no prueba nada.
    expect(deCuarto.length).toBeGreaterThan(hastaTercero.length);
    expect(idsDeContenidos(tercero)).toEqual(hastaTercero);
    expect(idsDeContenidos(egresado)).toEqual(await contenidosEsperados('M2', 'EG'));
  });

  it('Competencia Lectora no depende del curso y trae sus habilidades', async () => {
    const primero = await pruebaDe('1M', 'CL');
    const egresado = await pruebaDe('EG', 'CL');

    expect(idsDeContenidos(primero)).toEqual(idsDeContenidos(egresado));
    expect(primero.habilidades.map((h) => h.nombre)).toContain('Interpretar');
  });

  it('un eje desactivado no aparece', async () => {
    const antes = await pruebaDe('EG', 'M1');
    const eje = antes.ejes[0];
    if (!eje) throw new Error('M1 no tiene ejes en la semilla.');
    await entorno.bd.query('UPDATE contenido.eje_tematico SET activo = false WHERE id = $1', [
      eje.id,
    ]);
    try {
      const despues = await pruebaDe('EG', 'M1');
      expect(despues.ejes.map((e) => e.id)).not.toContain(eje.id);
      expect(despues.ejes).toHaveLength(antes.ejes.length - 1);
    } finally {
      await entorno.bd.query('UPDATE contenido.eje_tematico SET activo = true WHERE id = $1', [
        eje.id,
      ]);
    }
  });

  it.each([
    { caso: 'un curso que no existe', curso: 'XX', motivo: 'curso_inexistente' },
    { caso: 'un curso con otro formato', curso: '3° medio', motivo: undefined },
    { caso: 'sin curso', curso: undefined, motivo: undefined },
  ])('rechaza $caso con 400', async ({ curso, motivo }) => {
    const respuesta = await opciones(curso);

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.codigo).toBe('VALIDACION');
    if (motivo) expect(respuesta.body.error.detalles[0]).toMatchObject({ ruta: 'curso', motivo });
  });

  it('sin la sesión de la app responde 401', async () => {
    expect((await request(entorno.app).get(RUTA).query({ curso: '3M' })).status).toBe(401);
  });
});
