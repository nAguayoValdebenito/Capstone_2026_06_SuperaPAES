// Banco exclusivo de las bases temporales: borrador → en_revision → aprobada → publicada.
// Reutilizable en los prompts 15–17. Nunca desactiva triggers ni siembra preguntas en producción.
import type { Ejecutor } from '../db/transaccion.js';
import type {
  CodigoDificultad,
  PreguntaSeleccionada,
} from '../modulos/evaluaciones/evaluaciones.seleccion.tipos.js';

export interface DatosPreguntaDePrueba {
  prueba: string;
  dificultad: CodigoDificultad;
  contenidoId?: number;
  habilidadId?: number;
  textoId?: string;
  ordenEnTexto?: number;
}
export interface PreguntaDePrueba extends PreguntaSeleccionada {
  dificultad: CodigoDificultad;
  contenidoId: number;
  ejeId: number;
  habilidadId: number;
}

export async function crearPreguntaPublicada(
  bd: Ejecutor,
  datos: DatosPreguntaDePrueba,
): Promise<PreguntaDePrueba> {
  const {
    rows: [pregunta],
  } = await bd.query<PreguntaDePrueba>(
    `INSERT INTO contenido.pregunta
       (prueba_id, contenido_id, habilidad_id, tipo_pregunta_id, texto_estimulo_id,
        orden_en_texto, enunciado, explicacion, estado_pregunta_id, creado_en, actualizado_en)
     SELECT p.id, c.id, h.id, t.id, $4, $5, 'Enunciado de prueba', 'Explicación reservada', e.id, now(), now()
       FROM contenido.prueba p
       JOIN LATERAL (SELECT id, eje_id FROM contenido.contenido_tematico
         WHERE prueba_id = p.id AND ($2::int IS NULL OR id = $2) ORDER BY id LIMIT 1) c ON true
       JOIN LATERAL (SELECT id FROM contenido.habilidad
         WHERE prueba_id = p.id AND ($3::smallint IS NULL OR id = $3) ORDER BY id LIMIT 1) h ON true
       CROSS JOIN contenido.tipo_pregunta t CROSS JOIN contenido.estado_pregunta e
       WHERE p.codigo = $1 AND t.codigo = 'seleccion_multiple' AND e.codigo = 'borrador'
     RETURNING id::text AS "preguntaId", version, contenido_id AS "contenidoId", habilidad_id AS "habilidadId"`,
    [
      datos.prueba,
      datos.contenidoId ?? null,
      datos.habilidadId ?? null,
      datos.textoId ?? null,
      datos.ordenEnTexto ?? null,
    ],
  );
  if (!pregunta) throw new Error('No se encontró el temario de la pregunta de prueba.');
  await bd.query(
    `INSERT INTO contenido.alternativa (pregunta_id, letra, texto, es_correcta, explicacion)
    SELECT $1, letra, 'Alternativa ' || letra, letra = 'A', 'Explicación ' || letra
    FROM unnest(ARRAY['A','B','C','D']) letra`,
    [pregunta.preguntaId],
  );
  await publicarPreguntaDePrueba(bd, pregunta.preguntaId, datos.dificultad);
  const {
    rows: [publicada],
  } = await bd.query<PreguntaDePrueba>(
    `SELECT id::text AS "preguntaId", v.version, eje_id AS "ejeId", v.contenido_id AS "contenidoId",
       p.habilidad_id AS "habilidadId", v.dificultad FROM contenido.v_preguntas_publicadas v
       JOIN contenido.pregunta p USING(id) WHERE id = $1`,
    [pregunta.preguntaId],
  );
  if (!publicada) throw new Error('La pregunta no quedó publicada.');
  return publicada;
}

export async function publicarPreguntaDePrueba(
  bd: Ejecutor,
  id: string,
  dificultad: CodigoDificultad,
): Promise<void> {
  for (const estado of ['en_revision', 'aprobada', 'publicada']) {
    await bd.query(
      `UPDATE contenido.pregunta SET estado_pregunta_id = e.id,
      dificultad_asignada_id = d.id FROM contenido.estado_pregunta e, contenido.dificultad d
      WHERE pregunta.id = $1 AND e.codigo = $2 AND d.codigo = $3`,
      [id, estado, dificultad],
    );
  }
}

export async function crearTextoDePrueba(bd: Ejecutor): Promise<string> {
  const {
    rows: [fila],
  } = await bd.query<{ id: string }>(
    `INSERT INTO contenido.texto_estimulo (tipo_texto_id, titulo, contenido, creado_en)
     SELECT id, 'Texto de prueba', 'Un texto para la práctica.', now() FROM contenido.tipo_texto
     ORDER BY id LIMIT 1 RETURNING id::text`,
  );
  if (!fila) throw new Error('Falta el tipo de texto.');
  return fila.id;
}
