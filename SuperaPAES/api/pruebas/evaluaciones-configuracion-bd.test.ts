// C08 contra PostgreSQL real (HU-63.1, CU-31, RN-23, RN-35): editar una estructura con su reparto y cargar una tabla
// de conversión. Lo que no cuadra no se guarda y dice su motivo; cada cambio queda en la auditoría.
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { exigirBaseEnCi, urlBase } from './base-temporal.js';
import { prepararGenerador } from './generador-bd.js';

const RUTA = '/api/v1/admin/evaluaciones';

interface Reparto {
  id: number;
  nombre: string;
  cantidad: number;
  noPuntuables: number;
}

interface Estructura {
  id: number;
  tipo: string;
  cantidadMin: number;
  cantidadMax: number;
  noPuntuables: number;
  duracionMin: number | null;
  textos: number | null;
  usosGratisMes: number;
  reparto: Reparto[];
}

exigirBaseEnCi();
describe.skipIf(!urlBase)('configuración de evaluaciones con PostgreSQL (C08)', () => {
  const g = prepararGenerador('configuracion');
  const { entorno } = g;
  let pruebas: Record<string, number>;

  beforeAll(async () => {
    const { rows } = await entorno.bd.query<{ codigo: string; id: number }>(
      'SELECT codigo, id FROM contenido.prueba',
    );
    pruebas = Object.fromEntries(rows.map(({ codigo, id }) => [codigo, id]));
  });

  const estructuras = async (sesion: Record<string, string>, prueba = 'M1') => {
    const respuesta = await request(g.app)
      .get(`${RUTA}/estructuras`)
      .query({ pruebaId: pruebas[prueba] })
      .set(sesion);
    expect(respuesta.status).toBe(200);
    return respuesta.body.data as Estructura[];
  };

  const edicion = (e: Estructura) => ({
    cantidadMin: e.cantidadMin,
    cantidadMax: e.cantidadMax,
    noPuntuables: e.noPuntuables,
    duracionMin: e.duracionMin,
    textos: e.textos,
    usosGratisMes: e.usosGratisMes,
    reparto: e.reparto.map(({ id, cantidad }) => ({ id, cantidad })),
  });

  const guardar = (sesion: Record<string, string>, id: number, cuerpo: object) =>
    request(g.app)
      .put(`${RUTA}/estructuras/${String(id)}`)
      .set(sesion)
      .send(cuerpo);

  const tabla = (cambios: object = {}) => ({
    pruebaId: pruebas['M1'],
    procesoId: 1,
    anioAdmision: 2027,
    electivoAreaId: null,
    publicadaEn: '2027-01-05',
    filas: [
      { correctas: 0, puntaje: 100 },
      { correctas: 1, puntaje: 200 },
    ],
    ...cambios,
  });

  const cargar = (sesion: Record<string, string>, cuerpo: object) =>
    request(g.app).post(`${RUTA}/tablas-conversion`).set(sesion).send(cuerpo);

  const auditoria = async (accion: string) =>
    (
      await entorno.bd.query(
        `SELECT 1 FROM contenido.auditoria a JOIN contenido.accion_auditoria c ON c.id = a.accion_auditoria_id
          WHERE c.codigo = $1`,
        [accion],
      )
    ).rowCount;

  it('muestra cada tipo de evaluación de la prueba, con su reparto', async () => {
    const lista = await estructuras(await g.sesionAdmin());

    expect(lista.map((e) => e.tipo)).toEqual([
      'practica',
      'repaso',
      'diagnostico',
      'mini_ensayo',
      'ensayo',
    ]);
    const mini = lista.find((e) => e.tipo === 'mini_ensayo');
    expect(mini?.reparto.reduce((suma, r) => suma + r.cantidad, 0)).toBe(mini?.cantidadMax);
  });

  it('guarda el reparto cuando suma el total, y queda en la auditoría', async () => {
    const sesion = await g.sesionAdmin();
    const mini = (await estructuras(sesion)).find((e) => e.tipo === 'mini_ensayo')!;
    const datos = edicion(mini);
    datos.reparto[0]!.cantidad += 1;
    datos.reparto[1]!.cantidad -= 1;

    const respuesta = await guardar(sesion, mini.id, { ...datos, duracionMin: 50 });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data.duracionMin).toBe(50);
    expect(respuesta.body.data.reparto[0].cantidad).toBe(datos.reparto[0]!.cantidad);
    expect(await auditoria('editar_estructura')).toBeGreaterThan(0);
  });

  it('no guarda un reparto que no suma, y explica por qué (4.a)', async () => {
    const sesion = await g.sesionAdmin();
    const mini = (await estructuras(sesion)).find((e) => e.tipo === 'mini_ensayo')!;
    const datos = edicion(mini);
    datos.reparto[0]!.cantidad += 1;

    const respuesta = await guardar(sesion, mini.id, datos);

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.mensaje).toContain('El reparto suma 23 preguntas');
  });

  it('no acepta un eje de otra prueba (4.a)', async () => {
    const sesion = await g.sesionAdmin();
    const mini = (await estructuras(sesion)).find((e) => e.tipo === 'mini_ensayo')!;
    const otra = (await estructuras(sesion, 'M2')).find((e) => e.tipo === 'mini_ensayo')!;
    const datos = edicion(mini);
    datos.reparto[0]!.id = otra.reparto[0]!.id;

    const respuesta = await guardar(sesion, mini.id, datos);

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.mensaje).toContain('no es de esta estructura');
  });

  it('una evaluación sin tiempo no pasa a tener tiempo', async () => {
    const sesion = await g.sesionAdmin();
    const practica = (await estructuras(sesion)).find((e) => e.tipo === 'practica')!;

    const respuesta = await guardar(sesion, practica.id, {
      ...edicion(practica),
      duracionMin: 30,
    });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.mensaje).toBe('Esta evaluación no tiene tiempo.');
  });

  it('una tabla nueva queda vigente y queda en la auditoría (RN-23)', async () => {
    const sesion = await g.sesionAdmin();

    const respuesta = await cargar(sesion, tabla());
    const { body } = await request(g.app)
      .get(`${RUTA}/tablas-conversion`)
      .query({ pruebaId: pruebas['M1'] })
      .set(sesion);

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.data).toMatchObject({ anioAdmision: 2027, filas: 2, vigente: true });
    const vigentes = (body.data.tablas as { anioAdmision: number; vigente: boolean }[]).filter(
      (t) => t.vigente,
    );
    expect(vigentes.map((t) => t.anioAdmision)).toEqual([2027]);
    expect(await auditoria('cargar_tabla_conversion')).toBeGreaterThan(0);
  });

  it('no repite una tabla de la misma prueba, año y proceso', async () => {
    const sesion = await g.sesionAdmin();
    await cargar(sesion, tabla({ anioAdmision: 2028, publicadaEn: '2028-01-05' }));

    const respuesta = await cargar(
      sesion,
      tabla({ anioAdmision: 2028, publicadaEn: '2028-01-05' }),
    );

    expect(respuesta.status).toBe(409);
  });

  it('rechaza una tabla que no parte en 0 o cuyo puntaje baja', async () => {
    const sesion = await g.sesionAdmin();

    const sinCero = await cargar(sesion, tabla({ filas: [{ correctas: 1, puntaje: 200 }] }));
    const baja = await cargar(
      sesion,
      tabla({
        filas: [
          { correctas: 0, puntaje: 300 },
          { correctas: 1, puntaje: 200 },
        ],
      }),
    );

    expect(sinCero.status).toBe(400);
    expect(baja.status).toBe(400);
    expect(baja.body.error.mensaje).toContain('El puntaje baja');
  });

  it('en Ciencias cada tabla es de un electivo', async () => {
    const sesion = await g.sesionAdmin();

    const respuesta = await cargar(sesion, tabla({ pruebaId: pruebas['CIE'] }));

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.mensaje).toBe('Elige un electivo válido para esta prueba.');
  });

  it('un docente no entra', async () => {
    const docente = await g.sesionDocente(await g.sesionAdmin());

    const respuesta = await request(g.app)
      .get(`${RUTA}/estructuras`)
      .query({ pruebaId: pruebas['M1'] })
      .set(docente);

    expect(respuesta.status).toBe(403);
  });
});
