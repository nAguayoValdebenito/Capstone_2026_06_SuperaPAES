// Ayudantes de las pruebas de responder y del cupo (HU-32.1, HU-32.3), sobre el entorno de prácticas
// del prompt 15. Todo vive en una base temporal _test. La respuesta correcta de las preguntas de
// prueba es siempre la A (preguntas-de-prueba.ts).
import request from 'supertest';
import type { Express } from 'express';
import { expect } from 'vitest';
import { prepararPracticas } from './base-practicas.js';
import { crearEstudianteDePrueba } from './estudiantes-de-prueba.js';

export interface PreguntaEntregada {
  practicaId: string;
  itemId: string;
}

export function prepararRespuestas(prefijo: string) {
  const base = prepararPracticas(prefijo);
  const { entorno } = base;

  /** POST /evaluaciones/{id}/items/{item}/respuesta, en la app indicada o en la del entorno. */
  const responderHttp = (
    token: string,
    { practicaId, itemId }: PreguntaEntregada,
    cuerpo: Record<string, unknown>,
    app: Express = entorno.app,
  ) =>
    request(app)
      .post(`/api/v1/app/evaluaciones/${practicaId}/items/${itemId}/respuesta`)
      .set('Authorization', `Bearer ${token}`)
      .send(cuerpo);

  /** Id de la alternativa con esa letra de la pregunta del ítem. */
  async function alternativa(itemId: string, letra: string): Promise<number> {
    const { rows } = await entorno.bd.query<{ id: number }>(
      `SELECT a.id::int AS id FROM app.evaluacion_item i
         JOIN contenido.alternativa a ON a.pregunta_id = i.pregunta_id
        WHERE i.id = $1 AND a.letra = $2`,
      [itemId, letra],
    );
    const id = rows[0]?.id;
    if (!id) throw new Error('El ítem de prueba no tiene esa alternativa.');
    return id;
  }

  /** Inicia una práctica de M1 de dificultad media y entrega su primera pregunta. */
  async function practicaConPregunta(token: string, cantidad = 5): Promise<PreguntaEntregada> {
    const creada = await base.inicio(token, {
      pruebaId: base.pruebaId,
      dificultadId: base.mediaId,
      cantidad,
    });
    expect(creada.status).toBe(201);
    const practicaId = String(creada.body.data.id as number);
    return { practicaId, itemId: await entregar(token, practicaId) };
  }

  /** Pide la siguiente pregunta de la práctica y devuelve el id del ítem. */
  async function entregar(token: string, practicaId: string): Promise<string> {
    const entrega = await base.siguiente(token, practicaId);
    expect(entrega.status).toBe(200);
    return String(entrega.body.data.id as number);
  }

  /** Responde con la correcta (A) o con una incorrecta (B) y devuelve la respuesta HTTP. */
  async function responderCon(
    token: string,
    pregunta: PreguntaEntregada,
    letra: 'A' | 'B' = 'A',
    app?: Express,
  ) {
    const alternativaId = await alternativa(pregunta.itemId, letra);
    return responderHttp(token, pregunta, { alternativaId }, app);
  }

  /**
   * Saldo de preguntas extra: un abono por una invitación verificada, como lo exige
   * tg_movimiento_bono (HU-47 entregará los abonos de verdad).
   */
  async function darSaldoExtra(estudianteId: string, cantidad: number): Promise<void> {
    const invitadoId = await crearEstudianteDePrueba(entorno.bd, {
      correo: `invitado-${estudianteId}-${String(cantidad)}@ejemplo.cl`,
      contrasena: 'clave-del-invitado',
    });
    await entorno.bd.query(
      `WITH inv AS (
         INSERT INTO app.invitacion (invitante_id, invitado_id, registrado_en, verificado_en)
         VALUES ($1, $2, now(), now()) RETURNING id)
       INSERT INTO app.movimiento_bono
         (estudiante_id, tipo_movimiento_bono_id, cantidad, invitacion_id, creado_en)
       SELECT $1, t.id, $3, inv.id, now() FROM inv, contenido.tipo_movimiento_bono t
        WHERE t.codigo = 'abono'`,
      [estudianteId, invitadoId, cantidad],
    );
  }

  /** Fila de app.cupo_diario de una fecha de Chile escrita a mano (no la calcula el código). */
  async function cupoDe(estudianteId: string, fecha: string) {
    const { rows } = await entorno.bd.query<{ maximo: number; usadas: number }>(
      'SELECT maximo, usadas FROM app.cupo_diario WHERE estudiante_id = $1 AND fecha = $2::date',
      [estudianteId, fecha],
    );
    return rows[0] ?? null;
  }

  async function fijarCupo(estudianteId: string, fecha: string, maximo: number, usadas: number) {
    await entorno.bd.query(
      `INSERT INTO app.cupo_diario (estudiante_id, fecha, maximo, usadas) VALUES ($1, $2::date, $3, $4)
       ON CONFLICT (estudiante_id, fecha) DO UPDATE SET maximo = $3, usadas = $4`,
      [estudianteId, fecha, maximo, usadas],
    );
  }

  async function saldoExtra(estudianteId: string): Promise<number> {
    const { rows } = await entorno.bd.query<{ saldo: number }>(
      `SELECT COALESCE(SUM(t.signo * m.cantidad), 0)::int AS saldo FROM app.movimiento_bono m
         JOIN contenido.tipo_movimiento_bono t ON t.id = m.tipo_movimiento_bono_id
        WHERE m.estudiante_id = $1`,
      [estudianteId],
    );
    return rows[0]?.saldo ?? 0;
  }

  /** La respuesta guardada en el ítem, con el código de lo que se descontó. */
  async function itemGuardado(itemId: string) {
    const { rows } = await entorno.bd.query<{
      alternativaId: number | null;
      respondidaEn: Date | null;
      tiempoSeg: number | null;
      esCorrecta: boolean | null;
      consumo: string | null;
    }>(
      `SELECT i.alternativa_id::int AS "alternativaId", i.respondida_en AS "respondidaEn",
          i.tiempo_seg AS "tiempoSeg", i.es_correcta AS "esCorrecta", t.codigo AS consumo
         FROM app.evaluacion_item i LEFT JOIN contenido.tipo_consumo t ON t.id = i.tipo_consumo_id
        WHERE i.id = $1`,
      [itemId],
    );
    return rows[0];
  }

  /**
   * Pone el reloj en otra hora y vuelve a ingresar: el token de acceso dura 15 minutos según ese
   * mismo reloj, así que un salto de horas lo deja vencido.
   */
  async function irA(hora: Date, correo = 'practica@ejemplo.cl'): Promise<string> {
    entorno.fijarHora(hora);
    const ingreso = await request(entorno.app)
      .post('/api/v1/app/cuentas/ingreso')
      .send({ correo, contrasena: 'clave-para-practicar' });
    expect(ingreso.status).toBe(200);
    return ingreso.body.data.tokenAcceso as string;
  }

  /** Fecha de Chile (AAAA-MM-DD) de la hora del reloj de la app. */
  async function fechaDelReloj(): Promise<string> {
    const { rows } = await entorno.bd.query<{ fecha: string }>(
      "SELECT to_char($1::timestamptz AT TIME ZONE 'America/Santiago', 'YYYY-MM-DD') AS fecha",
      [entorno.ahora()],
    );
    return rows[0]?.fecha ?? '';
  }

  // base se entrega entera: sus ids (pruebaId, mediaId...) son getters que se leen después de beforeAll.
  return {
    base,
    entorno,
    responderHttp,
    responderCon,
    alternativa,
    practicaConPregunta,
    entregar,
    darSaldoExtra,
    cupoDe,
    fijarCupo,
    saldoExtra,
    itemGuardado,
    fechaDelReloj,
    irA,
  };
}
