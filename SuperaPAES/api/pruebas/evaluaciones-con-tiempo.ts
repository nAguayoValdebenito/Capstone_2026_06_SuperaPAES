// Evaluaciones con tiempo armadas en la base, para las pruebas con PostgreSQL: todavía no tienen ruta
// para empezar (HU-40), así que se insertan como lo hará el inicio y se cierran con cerrar_evaluacion.
import type { Ejecutor } from '../db/transaccion.js';
import { crearPreguntaPublicada, type PreguntaDePrueba } from './preguntas-de-prueba.js';

export interface DatosEvaluacionConTiempo {
  estudianteId: string;
  pruebaId: number;
  tipo: 'mini_ensayo' | 'ensayo';
  preguntas: PreguntaDePrueba[];
  /** Minutos desde que empezó; por defecto, recién empezada. */
  haceMin?: number;
}

/**
 * Arma un mini-ensayo o un ensayo con esas preguntas y devuelve su id y los de sus ítems. El ensayo usa
 * la tabla de conversión más reciente de la prueba (RN-23).
 */
export async function evaluacionConTiempo(
  bd: Ejecutor,
  { estudianteId, pruebaId, tipo, preguntas, haceMin = 0 }: DatosEvaluacionConTiempo,
): Promise<string[]> {
  const { rows } = await bd.query<{ id: string }>(
    `INSERT INTO app.evaluacion
     (estudiante_id, tipo_evaluacion_id, unica_por_anio_escolar, prueba_id, estructura_id,
      anio_escolar, cantidad_preguntas, duracion_min, estado_evaluacion_id, iniciada_en, vence_en,
      tabla_conversion_id)
     SELECT $1, t.id, t.unica_por_anio_escolar, $2, s.id, 0, $4, s.duracion_min, e.id,
       now() - $5 * INTERVAL '1 minute',
       now() - $5 * INTERVAL '1 minute' + s.duracion_min * INTERVAL '1 minute',
       CASE WHEN t.entrega_puntaje THEN (SELECT id FROM contenido.tabla_conversion
         WHERE prueba_id = $2 ORDER BY anio_admision DESC LIMIT 1) END
     FROM contenido.tipo_evaluacion t
     JOIN contenido.estructura_evaluacion s ON s.tipo_evaluacion_id = t.id AND s.prueba_id = $2
     CROSS JOIN contenido.estado_evaluacion e
     WHERE t.codigo = $3 AND e.codigo = 'en_curso'
     RETURNING id::text`,
    [estudianteId, pruebaId, tipo, preguntas.length, haceMin],
  );
  const id = rows[0]?.id;
  if (!id) throw new Error('Falta la estructura de la evaluación de prueba.');
  const items: string[] = [];
  for (const [indice, pregunta] of preguntas.entries()) {
    const { rows: item } = await bd.query<{ id: string }>(
      `INSERT INTO app.evaluacion_item (evaluacion_id, prueba_id, pregunta_id, version_pregunta, orden)
       VALUES ($1, $2, $3, $4, $5) RETURNING id::text`,
      [id, pruebaId, pregunta.preguntaId, pregunta.version, indice + 1],
    );
    items.push(item[0]?.id ?? '');
  }
  return [id, ...items];
}

/** Responde el ítem con esa letra (la A es la correcta), sin corregir: se corrige al cerrar. */
export async function marcar(bd: Ejecutor, itemId: string, letra: string): Promise<void> {
  await bd.query(
    `UPDATE app.evaluacion_item i SET alternativa_id = a.id, respondida_en = now()
     FROM contenido.alternativa a WHERE i.id = $1 AND a.pregunta_id = i.pregunta_id AND a.letra = $2`,
    [itemId, letra],
  );
}

/** Preguntas publicadas de M1, de dificultad media. */
export async function publicadas(bd: Ejecutor, cantidad: number): Promise<PreguntaDePrueba[]> {
  const preguntas: PreguntaDePrueba[] = [];
  for (let i = 0; i < cantidad; i++)
    preguntas.push(await crearPreguntaPublicada(bd, { prueba: 'M1', dificultad: 'media' }));
  return preguntas;
}
