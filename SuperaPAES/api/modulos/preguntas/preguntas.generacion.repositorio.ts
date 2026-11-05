// SQL del banco para el generador con IA (HU-16.2 y HU-17.2): las lecturas que usa para armar la instrucción
// y la escritura de las propuestas válidas. Consultas siempre parametrizadas.
import type { Ejecutor } from '../../db/transaccion.js';

/** Una pregunta ya aprobada que se le muestra a la IA como ejemplo de lo que se espera. */
export interface EjemploDePregunta {
  enunciado: string;
  alternativas: { letra: string; texto: string; esCorrecta: boolean }[];
}

/** Una propuesta de la IA que pasó la revisión automática, lista para entrar al banco como borrador. */
export interface PropuestaDeIa {
  loteId: string;
  pruebaId: number;
  contenidoId: number;
  habilidadId: number;
  dificultadSugerida: 'facil' | 'media' | 'dificil';
  enunciado: string;
  explicacion: string;
  textoEstimuloId: string | null;
  ordenEnTexto: number | null;
  /** Con las letras ya asignadas (el orden lo decide el servidor) y la explicación de cada una. */
  alternativas: { letra: string; texto: string; esCorrecta: boolean; explicacion: string }[];
}

// La pregunta nace en borrador, sin autor humano: su origen «ia» sale de lote_id (HU-11).
const INSERTAR_PROPUESTA = `
  INSERT INTO contenido.pregunta (prueba_id, contenido_id, habilidad_id, tipo_pregunta_id,
                                  dificultad_sugerida_id, enunciado, explicacion, texto_estimulo_id,
                                  orden_en_texto, lote_id, estado_pregunta_id, creado_en, actualizado_en)
  VALUES ($1, $2, $3, (SELECT id FROM contenido.tipo_pregunta WHERE codigo = 'seleccion_multiple'),
          (SELECT id FROM contenido.dificultad WHERE codigo = $4), $5, $6, $7, $8, $9,
          (SELECT id FROM contenido.estado_pregunta WHERE es_inicial), now(), now())
  RETURNING id::text AS id`;

const INSERTAR_ALTERNATIVAS = `
  INSERT INTO contenido.alternativa (pregunta_id, letra, texto, es_correcta, explicacion)
  SELECT $1, a.letra, a.texto, a.es_correcta, a.explicacion
    FROM unnest($2::text[], $3::text[], $4::boolean[], $5::text[])
         AS a (letra, texto, es_correcta, explicacion)`;

/** El texto de lectura de la IA que acompaña a las preguntas de un lote (HU-18.1). */
export interface TextoDeIa {
  loteId: string;
  /** Código de contenido.tipo_texto: literario o no_literario. */
  tipo: string;
  titulo: string;
  contenido: string;
}

const INSERTAR_TEXTO = `
  INSERT INTO contenido.texto_estimulo (tipo_texto_id, titulo, contenido, lote_id, creado_en)
  VALUES ((SELECT id FROM contenido.tipo_texto WHERE codigo = $1), $2, $3, $4, now())
  RETURNING id::text AS id`;

// Ejemplos: aprobadas o publicadas, de origen manual o IA. Las importadas quedan fuera (RN-29): no se
// sabe de dónde vienen y no deben servir de modelo para la IA.
const EJEMPLOS = `
  SELECT p.id, p.enunciado
    FROM contenido.pregunta p
    JOIN contenido.estado_pregunta e ON e.id = p.estado_pregunta_id
   WHERE p.contenido_id = $1 AND p.importacion_id IS NULL AND e.codigo IN ('aprobada', 'publicada')
   ORDER BY p.id DESC
   LIMIT $2`;

async function guardarPropuesta(tx: Ejecutor, propuesta: PropuestaDeIa): Promise<string> {
  const { rows } = await tx.query<{ id: string }>(INSERTAR_PROPUESTA, [
    propuesta.pruebaId,
    propuesta.contenidoId,
    propuesta.habilidadId,
    propuesta.dificultadSugerida,
    propuesta.enunciado,
    propuesta.explicacion,
    propuesta.textoEstimuloId,
    propuesta.ordenEnTexto,
    propuesta.loteId,
  ]);
  const id = rows[0]!.id;
  const alternativas = propuesta.alternativas;
  await tx.query(INSERTAR_ALTERNATIVAS, [
    id,
    alternativas.map((a) => a.letra),
    alternativas.map((a) => a.texto),
    alternativas.map((a) => a.esCorrecta),
    alternativas.map((a) => a.explicacion),
  ]);
  return id;
}

export interface PreguntaDeLote {
  id: string;
  enunciado: string;
  habilidad: string;
  dificultadSugerida: string | null;
}

export interface TextoDeLote {
  titulo: string | null;
  contenido: string | null;
}

export interface PreguntasDeLote {
  texto: TextoDeLote | null;
  preguntas: PreguntaDeLote[];
}

const PREGUNTAS_DE_LOTE = `
  SELECT p.id::text AS id, p.enunciado, h.nombre AS habilidad, d.nombre AS "dificultadSugerida"
    FROM contenido.pregunta p
    JOIN contenido.habilidad h ON h.id = p.habilidad_id
    LEFT JOIN contenido.dificultad d ON d.id = p.dificultad_sugerida_id
   WHERE p.lote_id = $1
   ORDER BY p.orden_en_texto NULLS LAST, p.id`;

const TEXTO_DE_LOTE = `
  SELECT titulo, contenido FROM contenido.texto_estimulo WHERE lote_id = $1 ORDER BY id LIMIT 1`;

/** HU-16.2 y HU-17.2: lo que el generador con IA lee del banco. */
export interface LecturasParaGenerar {
  /** Los enunciados del contenido en cualquier estado (también rechazadas y retiradas). */
  enunciadosDelContenido(contenidoId: number, tx?: Ejecutor): Promise<string[]>;
  /** Preguntas aprobadas o publicadas del contenido, de origen manual o IA, las más recientes primero. */
  ejemplosAprobados(contenidoId: number, limite: number): Promise<EjemploDePregunta[]>;
  /** HU-16.2: guarda una propuesta de la IA revisada como borrador, en la transacción del lote. */
  guardarPropuestaDeIa(propuesta: PropuestaDeIa, tx: Ejecutor): Promise<string>;
  /** HU-18.1: guarda el texto de lectura de la IA; las preguntas de su lote se enlazan a él. */
  guardarTextoDeIa(texto: TextoDeIa, tx: Ejecutor): Promise<string>;
  /** HU-17.3 y HU-18.3: las preguntas guardadas de un lote y su texto de lectura. */
  preguntasDeLote(loteId: string): Promise<PreguntasDeLote>;
}

/** Las preguntas guardadas de un lote y su texto de lectura, si tiene (HU-17.3 y HU-18.3). */
async function leerPreguntasDeLote(bd: Ejecutor, loteId: string): Promise<PreguntasDeLote> {
  const { rows: preguntas } = await bd.query<PreguntaDeLote>(PREGUNTAS_DE_LOTE, [loteId]);
  const { rows: textos } = await bd.query<TextoDeLote>(TEXTO_DE_LOTE, [loteId]);
  return { texto: textos[0] ?? null, preguntas };
}

export function crearPreguntasGeneracionRepositorio(bd: Ejecutor) {
  return {
    /** Guarda la propuesta como pregunta en borrador con sus alternativas; devuelve su id. */
    guardarPropuesta: (propuesta: PropuestaDeIa, tx: Ejecutor = bd) =>
      guardarPropuesta(tx, propuesta),

    /** Guarda el texto de lectura de un lote, sin autor humano (su origen «ia» sale de lote_id). */
    async guardarTexto(texto: TextoDeIa, tx: Ejecutor = bd): Promise<string> {
      const { rows } = await tx.query<{ id: string }>(INSERTAR_TEXTO, [
        texto.tipo,
        texto.titulo,
        texto.contenido,
        texto.loteId,
      ]);
      return rows[0]!.id;
    },

    preguntasDeLote: (loteId: string) => leerPreguntasDeLote(bd, loteId),

    /** Los enunciados del contenido en cualquier estado, también rechazadas y retiradas. */
    async enunciadosDelContenido(contenidoId: number, tx: Ejecutor = bd): Promise<string[]> {
      const { rows } = await tx.query<{ enunciado: string }>(
        'SELECT enunciado FROM contenido.pregunta WHERE contenido_id = $1',
        [contenidoId],
      );
      return rows.map((fila) => fila.enunciado);
    },

    async ejemplosAprobados(
      contenidoId: number,
      limite: number,
      tx: Ejecutor = bd,
    ): Promise<EjemploDePregunta[]> {
      if (limite <= 0) return [];
      const { rows } = await tx.query<{ id: string; enunciado: string }>(EJEMPLOS, [
        contenidoId,
        limite,
      ]);
      const ejemplos: EjemploDePregunta[] = [];
      for (const fila of rows) {
        const { rows: alternativas } = await tx.query<{
          letra: string;
          texto: string;
          esCorrecta: boolean;
        }>(
          `SELECT letra, texto, es_correcta AS "esCorrecta"
             FROM contenido.alternativa WHERE pregunta_id = $1 ORDER BY letra`,
          [fila.id],
        );
        ejemplos.push({ enunciado: fila.enunciado, alternativas });
      }
      return ejemplos;
    },
  };
}
