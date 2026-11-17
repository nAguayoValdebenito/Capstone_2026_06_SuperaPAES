import { describe, expect, it, vi } from 'vitest';
import { crearConTiempoRepositorio } from '../modulos/evaluaciones/evaluaciones.con-tiempo.repositorio.js';
import { prepararMini } from './mini-ensayo-base.js';

describe.skipIf(!process.env['DATABASE_URL_PRUEBAS'])('inicio del mini-ensayo (HU-40.1)', () => {
  const m = prepararMini('mini_inicio');
  const { base, entorno } = m;

  it('arma M1 con 22 ítems, 48 minutos, cuotas y sin corrección anticipada', async () => {
    await m.banco();
    const { token, id } = await base.sesion(undefined, undefined, 2020);
    const r = await m.iniciar(token);
    expect(r.status).toBe(201);
    expect(r.body.data).toMatchObject({ cantidad: 22, duracionMin: 48 });
    expect(r.body.data.preguntas).toHaveLength(22);
    expect(JSON.stringify(r.body)).not.toMatch(/alternativaCorrecta|explicacion|esCorrecta/);
    const { rows } = await entorno.bd.query<{ eje: number; dificultad: string }>(
      `SELECT v.eje_id AS eje,d.codigo AS dificultad FROM app.evaluacion_item i
       JOIN contenido.pregunta_version v ON (v.pregunta_id,v.version)=(i.pregunta_id,i.version_pregunta)
       JOIN contenido.dificultad d ON d.id=v.dificultad_id WHERE i.evaluacion_id=$1`,
      [r.body.data.id],
    );
    expect(
      [...new Set(rows.map((p) => p.eje))]
        .map((e) => rows.filter((p) => p.eje === e).length)
        .sort(),
    ).toEqual([5, 5, 6, 6]);
    expect(
      ['facil', 'media', 'dificil'].map((d) => rows.filter((p) => p.dificultad === d).length),
    ).toEqual([7, 10, 5]);
    expect(await m.cantidades(id)).toEqual({ evaluaciones: 1, usos: 1 });
  });

  it('un banco insuficiente no crea evaluación ni consume uso', async () => {
    const { token, id } = await base.sesion();
    const r = await m.iniciar(token);
    expect(r.status).toBe(409);
    expect(r.body.error.codigo).toBe('SIN_PREGUNTAS_SUFICIENTES');
    expect(await m.cantidades(id)).toEqual({ evaluaciones: 0, usos: 0 });
  });

  it.each(['practica', 'repaso'] as const)(
    'abandona %s abierta conservando lo respondido',
    async (tipo) => {
      await m.banco();
      const { token, id } = await base.sesion(undefined, undefined, 2020);
      let abierta: string;
      if (tipo === 'practica') {
        const r = await base.inicio(token, {
          pruebaId: base.pruebaId,
          cantidad: 5,
          dificultadId: base.mediaId,
        });
        abierta = String(r.body.data.id);
        const p = await base.siguiente(token, abierta);
        await base.responder(String(p.body.data.id));
      } else abierta = await m.repasoRespondido(token, id);
      const antes = await entorno.bd.query(
        'SELECT alternativa_id FROM app.evaluacion_item WHERE evaluacion_id=$1',
        [abierta],
      );
      expect(antes.rows).toHaveLength(1);
      expect(antes.rows[0]?.alternativa_id).not.toBeNull();
      expect((await m.iniciar(token)).status).toBe(201);
      expect(await m.estado(abierta)).toBe('abandonada');
      expect(
        (
          await entorno.bd.query(
            'SELECT alternativa_id FROM app.evaluacion_item WHERE evaluacion_id=$1',
            [abierta],
          )
        ).rows,
      ).toEqual(antes.rows);
    },
  );

  it('devuelve la evaluación con tiempo abierta al rechazar otro inicio', async () => {
    const { token, id } = await base.sesion();
    const abierta = await base.crearEvaluacionAbierta('diagnostico', id, base.pruebaId);
    const r = await m.iniciar(token);
    expect(r.status).toBe(409);
    expect(r.body.error.codigo).toBe('EVALUACION_CON_TIEMPO_ABIERTA');
    expect(String(r.body.error.detalles.abierta.id)).toBe(abierta);
  });

  it('dos inicios simultáneos dan 201 y 409, con un solo uso', async () => {
    await m.banco();
    const { token, id } = await base.sesion(undefined, undefined, 2020);
    const rs = await Promise.all([m.iniciar(token), m.iniciar(token)]);
    expect(rs.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await m.cantidades(id)).toEqual({ evaluaciones: 1, usos: 1 });
  });

  it('el uso mensual agotado explica el motivo y las opciones sin dejar otra evaluación', async () => {
    await m.banco();
    const { token, id } = await base.sesion(undefined, undefined, 2020);
    const primero = await m.iniciar(token);
    expect(primero.status).toBe(201);
    await entorno.bd.query("SELECT app.cerrar_evaluacion($1,'entregada')", [primero.body.data.id]);
    const r = await m.iniciar(token);
    expect(r.status).toBe(409);
    expect(r.body.error).toMatchObject({
      codigo: 'USO_GRATIS_AGOTADO',
      detalles: { motivo: 'limite_mensual', opciones: ['esperar_proximo_mes', 'ver_planes'] },
    });
    expect(await m.cantidades(id)).toEqual({ evaluaciones: 1, usos: 1 });
  });

  it('el inicio usa octubre o noviembre según el instante de Chile al comenzar', async () => {
    await m.banco();
    const ana = await base.sesion('ana@ejemplo.cl', undefined, 2020);
    const beto = await base.sesion('beto@ejemplo.cl', undefined, 2020);
    const reloj = vi.spyOn(crearConTiempoRepositorio(), 'contexto');
    reloj.mockResolvedValueOnce({ ahora: new Date('2026-11-01T02:59:59Z'), nivelId: null });
    expect((await m.iniciar(ana.token)).status).toBe(201);
    reloj.mockResolvedValueOnce({ ahora: new Date('2026-11-01T03:00:01Z'), nivelId: null });
    expect((await m.iniciar(beto.token)).status).toBe(201);
    const { rows } = await entorno.bd.query<{ estudiante: string; periodo: string }>(
      "SELECT estudiante_id::text AS estudiante,to_char(periodo,'YYYY-MM-DD') AS periodo FROM app.uso_gratis",
    );
    expect(rows).toEqual(
      expect.arrayContaining([
        { estudiante: ana.id, periodo: '2026-10-01' },
        { estudiante: beto.id, periodo: '2026-11-01' },
      ]),
    );
  });
});
