// Entorno compartido de los casos HTTP de inicio y entrega. Todo vive en una base temporal _test.
import path from 'node:path';
import request from 'supertest';
import { beforeAll, beforeEach, expect } from 'vitest';
import { ejecutarSemillas } from '../db/semillas.js';
import { usarBaseDeSesiones } from './base-sesiones.js';
import { vaciarTablas } from './base-temporal.js';
import { crearEstudianteDePrueba } from './estudiantes-de-prueba.js';
import { crearPreguntaPublicada } from './preguntas-de-prueba.js';

export const RUTA_PRACTICAS = '/api/v1/app/evaluaciones/practicas';

export function prepararPracticas(prefijo: string) {
  const entorno = usarBaseDeSesiones(prefijo);
  let pruebaId = 0;
  let lectoraId = 0;
  let mediaId = 0;
  let dificilId = 0;

  beforeAll(async () => {
    await ejecutarSemillas(entorno.bd, path.join(import.meta.dirname, '../db/semillas'));
    await entorno.bd.query(`INSERT INTO contenido.prueba_tipo_pregunta
      SELECT p.id, t.id FROM contenido.prueba p, contenido.tipo_pregunta t
      WHERE t.codigo = 'seleccion_multiple' ON CONFLICT DO NOTHING`);
    const { rows: pruebas } = await entorno.bd.query<{ id: number; codigo: string }>(
      "SELECT id, codigo FROM contenido.prueba WHERE codigo IN ('M1','CL')",
    );
    pruebaId = pruebas.find((p) => p.codigo === 'M1')?.id ?? 0;
    lectoraId = pruebas.find((p) => p.codigo === 'CL')?.id ?? 0;
    const { rows: dificultades } = await entorno.bd.query<{ id: number; codigo: string }>(
      'SELECT id, codigo FROM contenido.dificultad',
    );
    mediaId = dificultades.find((d) => d.codigo === 'media')?.id ?? 0;
    dificilId = dificultades.find((d) => d.codigo === 'dificil')?.id ?? 0;
  });

  beforeEach(async () => {
    await vaciarTablas(entorno.bd, ['contenido.pregunta', 'contenido.texto_estimulo']);
  });

  async function sesion(
    correo = 'practica@ejemplo.cl',
    pruebas = [pruebaId],
    egreso: number | null = 2026,
  ) {
    const contrasena = 'clave-para-practicar';
    const id = await crearEstudianteDePrueba(entorno.bd, { correo, contrasena });
    await entorno.bd.query('UPDATE app.estudiante SET anio_egreso = $2 WHERE id = $1', [
      id,
      egreso,
    ]);
    for (const prueba of pruebas)
      await entorno.bd.query(
        'INSERT INTO app.estudiante_prueba (estudiante_id, prueba_id) VALUES ($1,$2)',
        [id, prueba],
      );
    const ingreso = await request(entorno.app)
      .post('/api/v1/app/cuentas/ingreso')
      .send({ correo, contrasena });
    expect(ingreso.status).toBe(200);
    return { id, token: ingreso.body.data.tokenAcceso as string };
  }

  async function contenido(prueba: number, ordenNivel?: number) {
    const { rows } = await entorno.bd.query<{ id: number; ejeId: number }>(
      `SELECT c.id, c.eje_id AS "ejeId" FROM contenido.contenido_tematico c
       LEFT JOIN contenido.nivel_escolar n ON n.id=c.nivel_escolar_id
       WHERE c.prueba_id=$1 AND ($2::int IS NULL OR n.orden=$2) ORDER BY c.id LIMIT 1`,
      [prueba, ordenNivel ?? null],
    );
    const fila = rows[0];
    if (!fila) throw new Error('Falta contenido del temario de prueba.');
    return fila;
  }

  async function publicar(cantidad: number, datos: Parameters<typeof crearPreguntaPublicada>[1]) {
    for (let i = 0; i < cantidad; i++) await crearPreguntaPublicada(entorno.bd, datos);
  }

  const inicio = (token: string, datos: Record<string, unknown>) =>
    request(entorno.app).post(RUTA_PRACTICAS).set('Authorization', `Bearer ${token}`).send(datos);
  const siguiente = (token: string, id: string) =>
    request(entorno.app)
      .post(`${RUTA_PRACTICAS}/${id}/siguiente`)
      .set('Authorization', `Bearer ${token}`)
      .send();
  const cerrar = (token: string, id: string) =>
    request(entorno.app)
      .post(`${RUTA_PRACTICAS}/${id}/cerrar`)
      .set('Authorization', `Bearer ${token}`)
      .send();
  const resumen = (token: string, id: string) =>
    request(entorno.app)
      .get(`${RUTA_PRACTICAS}/${id}/resumen`)
      .set('Authorization', `Bearer ${token}`);

  async function responder(itemId: string) {
    await entorno.bd.query(
      `UPDATE app.evaluacion_item i SET alternativa_id=a.id, respondida_en=now(), tipo_consumo_id=t.id
       FROM contenido.alternativa a, contenido.tipo_consumo t
       WHERE i.id=$1 AND a.pregunta_id=i.pregunta_id AND a.letra='A' AND t.codigo='cupo'`,
      [itemId],
    );
  }

  /** Evaluación abierta preparada directamente en la base temporal para comprobar RN-19. */
  async function crearEvaluacionAbierta(
    tipo: 'repaso' | 'diagnostico',
    estudianteId: string,
    pruebaIdDeEvaluacion: number,
  ): Promise<string> {
    const { rows } = await entorno.bd.query<{ id: string }>(
      `INSERT INTO app.evaluacion
       (estudiante_id, tipo_evaluacion_id, unica_por_anio_escolar, prueba_id, estructura_id,
        anio_escolar, cantidad_preguntas, duracion_min, estado_evaluacion_id, vence_en)
       SELECT $1, t.id, t.unica_por_anio_escolar, $2, s.id, 0, s.cantidad_min,
         s.duracion_min, e.id,
         CASE WHEN s.duracion_min IS NOT NULL THEN now() + s.duracion_min * INTERVAL '1 minute' END
       FROM contenido.tipo_evaluacion t JOIN contenido.estructura_evaluacion s ON s.tipo_evaluacion_id=t.id
       CROSS JOIN contenido.estado_evaluacion e
       WHERE t.codigo=$3 AND e.codigo='en_curso' AND s.prueba_id=$2
       RETURNING id::text`,
      [estudianteId, pruebaIdDeEvaluacion, tipo],
    );
    const id = rows[0]?.id;
    if (!id) throw new Error('Falta la estructura de la evaluación de prueba.');
    return id;
  }

  return {
    entorno,
    sesion,
    contenido,
    publicar,
    inicio,
    siguiente,
    cerrar,
    resumen,
    responder,
    crearEvaluacionAbierta,
    get pruebaId() {
      return pruebaId;
    },
    get lectoraId() {
      return lectoraId;
    },
    get mediaId() {
      return mediaId;
    },
    get dificilId() {
      return dificilId;
    },
  };
}
