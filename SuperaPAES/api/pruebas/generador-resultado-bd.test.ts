// C05 contra PostgreSQL real y con un proveedor de IA falso: los topes usados (RNF-03), el resultado de un lote
// pregunta por pregunta (HU-17.3) y el texto de lectura con sus preguntas (HU-18.3). Lo descartado nunca
// devuelve el texto del modelo (HU-16.5).
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import type { SolicitudGeneracion } from '../adaptadores/ia/proveedor.js';
import { ErrorIANoDisponible } from '../comun/errores.js';
import { exigirBaseEnCi, urlBase } from './base-temporal.js';
import { prepararGenerador, RUTA_LOTES } from './generador-bd.js';
import { propuestaValida, resultadoDeTexto, resultadoValido } from './ia-falsa.js';

const RUTA_USO = '/api/v1/admin/generador/uso';
const CANARIO = 'CANARIO-DEL-MODELO';

const valida = (s: SolicitudGeneracion, n: number) => resultadoValido(s, n);
const conHabilidadInvalida = (s: SolicitudGeneracion, n: number) => ({
  ...resultadoValido(s, n),
  preguntas: [{ ...propuestaValida(s, n), enunciado: `¿Qué es ${CANARIO}?`, habilidad: 'XX' }],
});

exigirBaseEnCi();
describe.skipIf(!urlBase)('consultas del generador con PostgreSQL (C05)', () => {
  const g = prepararGenerador('resultado');
  const { ia } = g;

  const leerResultado = (sesion: Awaited<ReturnType<typeof g.sesionAdmin>>, id: unknown) =>
    request(g.app)
      .get(`${RUTA_LOTES}/${String(id)}/resultado`)
      .set(sesion);

  it('muestra cada pregunta guardada y cada descarte, sin el texto del modelo', async () => {
    const sesion = await g.sesionAdmin();
    const creado = await g.pedirLote(sesion, { contenidoId: g.contenidos.m1, cantidad: 2 });
    ia.encolar(valida);
    ia.encolar(conHabilidadInvalida);

    await g.trabajador().procesarPendientes();
    const respuesta = await leerResultado(sesion, creado.body.data.id);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data.texto).toBeNull();
    expect(respuesta.body.data.preguntas).toHaveLength(1);
    expect(respuesta.body.data.preguntas[0]).toMatchObject({
      id: expect.anything() as unknown,
      habilidad: expect.any(String) as unknown,
    });
    expect(respuesta.body.data.descartes).toEqual([
      expect.objectContaining({ orden: 2, motivo: 'habilidad_invalida' }),
    ]);
    expect(JSON.stringify(respuesta.body)).not.toContain(CANARIO);
  });

  it('anota el descarte cuando la IA no responde', async () => {
    const sesion = await g.sesionAdmin();
    const creado = await g.pedirLote(sesion, { contenidoId: g.contenidos.m1, cantidad: 2 });
    ia.encolar(valida, new ErrorIANoDisponible());

    await g.trabajador().procesarPendientes();
    const respuesta = await leerResultado(sesion, creado.body.data.id);

    expect(respuesta.body.data.descartes).toEqual([
      expect.objectContaining({ orden: 2, motivo: 'IA_NO_DISPONIBLE' }),
    ]);
  });

  it('entrega el texto de lectura con sus preguntas en orden', async () => {
    const sesion = await g.sesionAdmin();
    const creado = await g.pedirLote(sesion, {
      contenidoId: g.contenidos.cl,
      cantidad: 3,
      conTexto: true,
    });
    ia.encolar((_s: SolicitudGeneracion, n: number) => resultadoDeTexto(n));
    for (let i = 0; i < 3; i++) ia.encolar(valida);

    await g.trabajador().procesarPendientes();
    const respuesta = await leerResultado(sesion, creado.body.data.id);

    expect(respuesta.body.data.texto.contenido).toEqual(expect.any(String));
    expect(respuesta.body.data.preguntas).toHaveLength(3);
  });

  it('responde 404 si el lote no existe', async () => {
    const respuesta = await leerResultado(await g.sesionAdmin(), 999_999);

    expect(respuesta.status).toBe(404);
  });

  it('informa lo usado de los topes: cuenta lo pedido y sus máximos', async () => {
    const sesion = await g.sesionAdmin();
    const antes = await request(g.app).get(RUTA_USO).set(sesion);
    await g.pedirLote(sesion, { contenidoId: g.contenidos.m2, cantidad: 3 });

    const despues = await request(g.app).get(RUTA_USO).set(sesion);

    expect(despues.status).toBe(200);
    expect(despues.body.data.hoy.maximo).toBe(100);
    expect(despues.body.data.mes.maximoUsd).toBe(10);
    expect(despues.body.data.hoy.usadas).toBe(antes.body.data.hoy.usadas + 3);
  });

  it('un docente no ve los topes', async () => {
    const docente = await g.sesionDocente(await g.sesionAdmin());

    const respuesta = await request(g.app).get(RUTA_USO).set(docente);

    expect(respuesta.status).toBe(403);
  });
});
