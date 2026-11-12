// Anular una pregunta con error contra PostgreSQL real (HU-50.2, HU-50 esc. 3, CU-26a, RN-22; ver
// base-temporal.ts). Un estudiante responde bien la pregunta en una práctica que cierra; otro la tiene en
// una práctica abierta. Al anularla deja de entregarse, sus ítems quedan anulados, el resultado cerrado
// se recalcula (queda con recalculado_en), la práctica abierta sigue y al cerrarla no la cuenta, y sus
// avisos pendientes quedan resueltos. Anular otra vez da 409 sin recalcular ni repetir la auditoría.
import type pg from 'pg';
import { describe, expect, it } from 'vitest';
import type { Servicios } from '../app.js';
import { exigirBaseEnCi, urlBase } from './base-temporal.js';
import { prepararRespuestas } from './respuestas-de-prueba.js';
import { crearCuenta } from './revision-bd.js';

exigirBaseEnCi();
describe.skipIf(!urlBase)('anular una pregunta con PostgreSQL (HU-50.2)', () => {
  const r = prepararRespuestas('anulacion');
  const { base, entorno } = r;

  const preguntaDe = async (itemId: string) =>
    String(
      (
        await entorno.bd.query<{ id: string }>(
          'SELECT pregunta_id::text AS id FROM app.evaluacion_item WHERE id = $1',
          [itemId],
        )
      ).rows[0]?.id,
    );

  /** El estudiante A responde bien su primera pregunta y cierra la práctica. */
  async function practicaCerrada() {
    const { token } = await base.sesion('cerrada@ejemplo.cl');
    const pregunta = await r.practicaConPregunta(token, 5);
    expect((await r.responderCon(token, pregunta, 'A')).status).toBe(200);
    expect((await base.cerrar(token, pregunta.practicaId)).status).toBe(200);
    return { practicaId: pregunta.practicaId, preguntaId: await preguntaDe(pregunta.itemId) };
  }

  /** El estudiante B pide preguntas hasta recibir la indicada; su práctica queda abierta. */
  async function practicaAbiertaCon(preguntaId: string) {
    const { token } = await base.sesion('abierta@ejemplo.cl');
    const { practicaId, itemId: primero } = await r.practicaConPregunta(token, 5);
    let itemId = primero;
    // Las otras se responden mal: así la siguiente entrega trae una pregunta nueva.
    for (let i = 0; i < 5 && (await preguntaDe(itemId)) !== preguntaId; i++) {
      await r.responderCon(token, { practicaId, itemId }, 'B');
      itemId = await r.entregar(token, practicaId);
    }
    expect(await preguntaDe(itemId)).toBe(preguntaId);
    return { token, practicaId, itemId };
  }

  const resultado = async (evaluacionId: string) =>
    (
      await entorno.bd.query<{ puntuables: number; correctas: number; recalculada: boolean }>(
        `SELECT puntuables, correctas, recalculado_en IS NOT NULL AS recalculada
           FROM app.resultado_evaluacion WHERE evaluacion_id = $1`,
        [evaluacionId],
      )
    ).rows[0];

  const consulta = async <T extends object>(sql: string, valores: unknown[]) =>
    (await entorno.bd.query<T & pg.QueryResultRow>(sql, valores)).rows;

  async function avisar(preguntaId: string) {
    await entorno.bd.query(
      `INSERT INTO app.reporte_pregunta (estudiante_id, pregunta_id, version_pregunta, motivo_reporte_id,
                                         comentario, estado_reporte_id, creado_en)
       SELECT e.id, p.id, p.version, (SELECT id FROM contenido.motivo_reporte WHERE codigo = 'respuesta'),
              'La correcta no es la A.', (SELECT id FROM contenido.estado_reporte WHERE codigo = 'pendiente'), now()
         FROM contenido.pregunta p, app.estudiante e WHERE p.id = $1 AND e.correo = 'cerrada@ejemplo.cl'`,
      [preguntaId],
    );
  }

  async function preparar() {
    await base.publicar(5, { prueba: 'M1', dificultad: 'media' });
    const cerrada = await practicaCerrada();
    const abierta = await practicaAbiertaCon(cerrada.preguntaId);
    await avisar(cerrada.preguntaId);
    const admin = await crearCuenta(entorno.bd, ['admin@anulacion.cl', 'admin']);
    const servicios: Servicios = entorno.crearServiciosCon({});
    return { cerrada, abierta, admin, servicios };
  }

  it('la retira, anula sus ítems, recalcula la cerrada, resuelve sus avisos y lo audita', async () => {
    const { cerrada, abierta, admin, servicios } = await preparar();
    const { preguntaId } = cerrada;
    const antes = await resultado(cerrada.practicaId);

    const impacto = await servicios.evaluaciones.impactoDeAnular(preguntaId);
    const anulada = await servicios.preguntas.anularPregunta(admin, preguntaId);

    expect(antes).toEqual({ puntuables: 1, correctas: 1, recalculada: false });
    expect(impacto).toEqual({ evaluacionesCerradas: 1, evaluacionesAbiertas: 1 });
    expect(anulada).toEqual({
      preguntaId,
      estado: { codigo: 'retirada', nombre: 'Retirada' },
      evaluacionesRecalculadas: 1,
      avisosCerrados: 1,
    });
    expect(await resultado(cerrada.practicaId)).toEqual({
      puntuables: 0,
      correctas: 0,
      recalculada: true,
    });
    expect(
      await consulta('SELECT 1 FROM contenido.v_preguntas_publicadas WHERE id = $1', [preguntaId]),
    ).toEqual([]);
    expect(
      await consulta<{ anulada: boolean }>(
        'SELECT anulada FROM app.evaluacion_item WHERE pregunta_id = $1',
        [preguntaId],
      ),
    ).toEqual([{ anulada: true }, { anulada: true }]);
    expect(
      await consulta(
        `SELECT e.codigo AS estado, r.resuelto_por::text AS por FROM app.reporte_pregunta r
           JOIN contenido.estado_reporte e ON e.id = r.estado_reporte_id WHERE r.pregunta_id = $1`,
        [preguntaId],
      ),
    ).toEqual([{ estado: 'resuelto', por: admin }]);
    expect(
      await consulta(
        `SELECT e.codigo AS hacia, h.usuario_id::text AS usuario
           FROM contenido.historial_estado_pregunta h JOIN contenido.estado_pregunta e ON e.id = h.hacia_id
          WHERE h.pregunta_id = $1 ORDER BY h.id DESC LIMIT 1`,
        [preguntaId],
      ),
    ).toEqual([{ hacia: 'retirada', usuario: admin }]);

    // La práctica abierta no se rompe: se responde y se cierra, y la anulada no cuenta.
    expect((await r.responderCon(abierta.token, abierta, 'A')).status).toBe(200);
    expect((await base.cerrar(abierta.token, abierta.practicaId)).status).toBe(200);
    const final = await resultado(abierta.practicaId);
    expect(final?.correctas).toBe(0);
  });

  it('anular dos veces da 409, no vuelve a recalcular ni repite la auditoría', async () => {
    const { cerrada, admin, servicios } = await preparar();
    const { preguntaId } = cerrada;
    await servicios.preguntas.anularPregunta(admin, preguntaId);
    const recalculo = async () =>
      (
        await consulta<{ en: string }>(
          'SELECT recalculado_en::text AS en FROM app.resultado_evaluacion WHERE evaluacion_id = $1',
          [cerrada.practicaId],
        )
      )[0]?.en;
    const primero = await recalculo();

    await expect(servicios.preguntas.anularPregunta(admin, preguntaId)).rejects.toThrow(
      'La pregunta está «Retirada»: solo se anulan preguntas publicadas.',
    );

    expect(await recalculo()).toBe(primero);
    expect(
      await consulta(
        `SELECT au.despues FROM contenido.auditoria au
           JOIN contenido.accion_auditoria a ON a.id = au.accion_auditoria_id
          WHERE a.codigo = 'anular_pregunta' AND au.entidad_id = $1`,
        [preguntaId],
      ),
    ).toHaveLength(1);
  });
});
