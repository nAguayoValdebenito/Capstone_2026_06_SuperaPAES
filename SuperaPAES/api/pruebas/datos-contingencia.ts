// Datos de las pruebas de contingencia (TEC-08): respaldo, restauración y reintegración. Todo se crea en
// bases temporales _test con las mismas reglas de la base publicada (triggers y restricciones activos):
// estudiantes, invitaciones, bonos, prácticas respondidas y cerradas con cerrar_evaluacion, y avisos de
// las tiendas. Nunca se desactiva un trigger.
import path from 'node:path';
import type pg from 'pg';
import { ejecutarSemillas } from '../db/semillas.js';
import type { Ejecutor } from '../db/transaccion.js';
import { crearEstudianteDePrueba } from './estudiantes-de-prueba.js';
import { crearPreguntaPublicada } from './preguntas-de-prueba.js';

export const CLAVE_DE_PRUEBA = 'clave-de-prueba-del-respaldo-0123456789abcdef';

/** Semillas, tipos de pregunta por prueba y cinco preguntas publicadas de M1. Devuelve sus ids. */
export async function prepararContenido(bd: pg.ClientBase): Promise<string[]> {
  await ejecutarSemillas(bd, path.join(import.meta.dirname, '../db/semillas'));
  await bd.query(`INSERT INTO contenido.prueba_tipo_pregunta
    SELECT p.id, t.id FROM contenido.prueba p, contenido.tipo_pregunta t
    WHERE t.codigo = 'seleccion_multiple' ON CONFLICT DO NOTHING`);
  const ids: string[] = [];
  for (let i = 0; i < 5; i++) {
    ids.push((await crearPreguntaPublicada(bd, { prueba: 'M1', dificultad: 'media' })).preguntaId);
  }
  return ids;
}

export async function crearEstudiante(bd: Ejecutor, correo: string): Promise<string> {
  const id = await crearEstudianteDePrueba(bd, {
    correo,
    contrasena: 'clave-de-contingencia',
    correoVerificado: true,
  });
  await bd.query(
    `INSERT INTO app.consentimiento (estudiante_id, documento_legal_id, aceptado_en)
     SELECT $1, id, now() FROM contenido.documento_legal ORDER BY id LIMIT 1`,
    [id],
  );
  return id;
}

export interface Practica {
  estudianteId: string;
  preguntas: readonly string[];
  /** Letra de cada respuesta, en orden; null deja la pregunta entregada sin responder. */
  letras: readonly ('A' | 'B' | null)[];
  /** Estado final con que se cierra (cerrar_evaluacion), o null para dejarla abierta. */
  cierre: 'entregada' | 'abandonada' | null;
  /** Qué se descontó al responder: el cupo diario o las preguntas extra del bono. */
  consumo?: 'cupo' | 'bono';
}

/** Práctica de M1 como la arma la API: en curso, con sus preguntas y respuestas, y cerrada por la base. */
export async function crearPractica(bd: Ejecutor, practica: Practica): Promise<string> {
  const { rows } = await bd.query<{ id: string }>(
    `INSERT INTO app.evaluacion (estudiante_id, tipo_evaluacion_id, unica_por_anio_escolar, prueba_id,
       estructura_id, anio_escolar, cantidad_preguntas, estado_evaluacion_id)
     SELECT $1, t.id, false, s.prueba_id, s.id, 0, $2, e.id
       FROM contenido.tipo_evaluacion t
       JOIN contenido.estructura_evaluacion s ON s.tipo_evaluacion_id = t.id
       JOIN contenido.prueba p ON p.id = s.prueba_id
       CROSS JOIN contenido.estado_evaluacion e
      WHERE t.codigo = 'practica' AND p.codigo = 'M1' AND e.codigo = 'en_curso'
     RETURNING id::text`,
    [practica.estudianteId, practica.preguntas.length],
  );
  const id = rows[0]?.id;
  if (!id) throw new Error('Falta la estructura de la práctica de M1.');
  for (const [indice, preguntaId] of practica.preguntas.entries()) {
    await agregarItem(bd, id, indice + 1, {
      preguntaId,
      letra: practica.letras[indice] ?? null,
      consumo: practica.consumo ?? 'cupo',
    });
  }
  if (practica.cierre)
    await bd.query('SELECT app.cerrar_evaluacion($1, $2)', [id, practica.cierre]);
  return id;
}

interface ItemDePrueba {
  preguntaId: string;
  letra: 'A' | 'B' | null;
  consumo: 'cupo' | 'bono';
}

async function agregarItem(
  bd: Ejecutor,
  evaluacionId: string,
  orden: number,
  { preguntaId, letra, consumo }: ItemDePrueba,
): Promise<void> {
  await bd.query(
    `INSERT INTO app.evaluacion_item (evaluacion_id, prueba_id, pregunta_id, version_pregunta, orden,
       alternativa_id, respondida_en, tiempo_seg, tipo_consumo_id)
     SELECT $1, p.prueba_id, p.id, p.version, $3, a.id, CASE WHEN a.id IS NOT NULL THEN now() END,
            CASE WHEN a.id IS NOT NULL THEN 20 END, CASE WHEN a.id IS NOT NULL THEN c.id END
       FROM contenido.pregunta p
       LEFT JOIN contenido.alternativa a ON a.pregunta_id = p.id AND a.letra = $4
       CROSS JOIN contenido.tipo_consumo c
      WHERE p.id = $2 AND c.codigo = $5`,
    [evaluacionId, preguntaId, orden, letra, consumo],
  );
}

/** Invitación verificada y su abono de 5 preguntas extra para quien invitó. Devuelve la invitación. */
export async function crearInvitacionConBono(
  bd: Ejecutor,
  invitanteId: string,
  invitadoId: string,
  verificada = true,
): Promise<string> {
  const { rows } = await bd.query<{ id: string }>(
    `INSERT INTO app.invitacion (invitante_id, invitado_id, registrado_en, verificado_en, bono_entregado)
     VALUES ($1, $2, now(), CASE WHEN $3 THEN now() END, $3) RETURNING id::text`,
    [invitanteId, invitadoId, verificada],
  );
  const id = rows[0]?.id ?? '';
  if (verificada) await crearAbono(bd, invitanteId, id);
  return id;
}

export async function crearAbono(bd: Ejecutor, estudianteId: string, invitacionId: string) {
  await bd.query(
    `INSERT INTO app.movimiento_bono (estudiante_id, tipo_movimiento_bono_id, cantidad, invitacion_id, creado_en)
     SELECT $1, id, 5, $2, now() FROM contenido.tipo_movimiento_bono WHERE codigo = 'abono'`,
    [estudianteId, invitacionId],
  );
}

/** Un consumo de preguntas extra por cada respuesta descontada del bono en la evaluación. */
export async function crearConsumos(bd: Ejecutor, estudianteId: string, evaluacionId: string) {
  await bd.query(
    `INSERT INTO app.movimiento_bono (estudiante_id, tipo_movimiento_bono_id, cantidad, evaluacion_item_id, creado_en)
     SELECT $1, t.id, 1, i.id, now()
       FROM app.evaluacion_item i JOIN contenido.tipo_consumo c ON c.id = i.tipo_consumo_id
       CROSS JOIN contenido.tipo_movimiento_bono t
      WHERE i.evaluacion_id = $2 AND c.codigo = 'bono' AND t.codigo = 'consumo' ORDER BY i.id`,
    [estudianteId, evaluacionId],
  );
}

/** Suscripción de prueba en Google Play (sin aviso). Devuelve su id. */
export async function crearSuscripcion(bd: Ejecutor, estudianteId: string): Promise<string> {
  const { rows } = await bd.query<{ id: string }>(
    `INSERT INTO app.suscripcion (estudiante_id, plan_id, estado_suscripcion_id, vigente, canal_venta_id, creado_en)
     SELECT $1, (SELECT min(id) FROM contenido.plan), e.id, true, c.id, now()
       FROM contenido.estado_suscripcion e, contenido.canal_venta c
      WHERE e.codigo = 'activa' AND c.codigo = 'google_play'
     RETURNING id::text`,
    [estudianteId],
  );
  return rows[0]?.id ?? '';
}

/** Aviso de Google Play procesado, ligado o no a una suscripción. Devuelve su id. */
export async function crearAviso(
  bd: Ejecutor,
  idEvento: string,
  suscripcionId: string | null,
): Promise<string> {
  const { rows } = await bd.query<{ id: string }>(
    `INSERT INTO app.evento_pasarela (canal_venta_id, id_evento_pasarela, tipo, suscripcion_id,
       resultado_evento_id, recibido_en, procesado_en)
     SELECT c.id, $1, 'SUBSCRIPTION_RENEWED', $2, r.id, now(), now()
       FROM contenido.canal_venta c, contenido.resultado_evento r
      WHERE c.codigo = 'google_play' AND r.codigo = 'procesado'
     RETURNING id::text`,
    [idEvento, suscripcionId],
  );
  return rows[0]?.id ?? '';
}
