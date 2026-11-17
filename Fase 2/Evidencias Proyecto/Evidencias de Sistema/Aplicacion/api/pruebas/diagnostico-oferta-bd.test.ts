import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { prepararMini } from './mini-ensayo-base.js';

describe.skipIf(!process.env['DATABASE_URL_PRUEBAS'])(
  'oferta y ejes omitidos del diagnóstico (HU-36.2)',
  () => {
    const m = prepararMini('diagnostico_oferta');
    const { base, entorno } = m;
    const conToken = (token: string) => ({ Authorization: `Bearer ${token}` });

    /** Los contenidos del cuarto eje se enseñan en 4° medio y los demás en 1° medio. */
    async function cuartoEjeEn4Medio() {
      const { rows } = await entorno.bd.query<{ id: number; nombre: string }>(
        'SELECT id, nombre FROM contenido.eje_tematico WHERE prueba_id=$1 ORDER BY orden',
        [base.pruebaId],
      );
      await entorno.bd.query(
        `UPDATE contenido.contenido_tematico SET nivel_escolar_id=(
          SELECT id FROM contenido.nivel_escolar WHERE anios_para_egreso=CASE WHEN eje_id=$2 THEN 0 ELSE 3 END)
         WHERE prueba_id=$1`,
        [base.pruebaId, rows[3]!.id],
      );
      return rows[3]!;
    }

    it('la disponibilidad trae las preguntas, los minutos y los ejes del curso', async () => {
      await cuartoEjeEn4Medio();
      const { token } = await base.sesion(undefined, undefined, 2029);
      const r = await request(entorno.app)
        .get('/api/v1/app/evaluaciones/diagnosticos/disponibilidad')
        .query({ pruebaId: base.pruebaId })
        .set(conToken(token));
      expect(r.status).toBe(200);
      expect(r.body.data).toMatchObject({
        pruebaId: base.pruebaId,
        cantidad: 20,
        ejes: 3,
        habilidades: 0,
        disponible: true,
        motivo: null,
      });
      expect(r.body.data.duracionMin).toBeGreaterThan(0);
    });

    it('el resultado nombra el eje omitido y el curso en que se enseña', async () => {
      const omitido = await cuartoEjeEn4Medio();
      await m.banco();
      const { token } = await base.sesion(undefined, undefined, 2029);
      const inicio = await request(entorno.app)
        .post('/api/v1/app/evaluaciones/diagnosticos')
        .set(conToken(token))
        .send({ pruebaId: base.pruebaId });
      expect(inicio.status).toBe(201);
      const id = (inicio.body as { data: { id: number } }).data.id;
      expect((await m.entregar(token, id)).status).toBe(200);

      const resultado = await request(entorno.app)
        .get(`/api/v1/app/evaluaciones/${id}/resultado`)
        .set(conToken(token));
      expect(resultado.body.data.ejesOmitidos).toEqual([
        { id: omitido.id, nombre: omitido.nombre, curso: '4° medio' },
      ]);
    });

    it('sin ejes omitidos, la lista va vacía; el mini-ensayo no la trae', async () => {
      await m.banco();
      const { token } = await base.sesion(undefined, undefined, 2020);
      const diagnostico = await request(entorno.app)
        .post('/api/v1/app/evaluaciones/diagnosticos')
        .set(conToken(token))
        .send({ pruebaId: base.pruebaId });
      const id = (diagnostico.body as { data: { id: number } }).data.id;
      await m.entregar(token, id);
      const resultado = await request(entorno.app)
        .get(`/api/v1/app/evaluaciones/${id}/resultado`)
        .set(conToken(token));
      expect(resultado.body.data.ejesOmitidos).toEqual([]);

      const mini = await m.iniciar(token);
      const miniId = (mini.body as { data: { id: number } }).data.id;
      await m.entregar(token, miniId);
      const resultadoMini = await request(entorno.app)
        .get(`/api/v1/app/evaluaciones/${miniId}/resultado`)
        .set(conToken(token));
      expect(resultadoMini.body.data).not.toHaveProperty('ejesOmitidos');
    });
  },
);
