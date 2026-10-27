// SQL para crear y editar preguntas con sus alternativas (HU-12.1). Consultas siempre parametrizadas.
// Escribe contenido.pregunta y contenido.alternativa; las reglas del ciclo de vida las aplica la base
// (tg_pregunta, tg_pregunta_creada y tg_alternativa): parte en borrador, solo se edita en una etapa
// editable, la versión sube sola y el historial queda con el usuario de supera.usuario_id.
// Lee por su código las listas tipo_pregunta, dificultad y estado_pregunta. La consulta del banco y las
// listas de opciones están en preguntas.repositorio.ts.
import type { Ejecutor } from '../../db/transaccion.js';
import { type Opcion, ORIGEN } from './preguntas.repositorio.js';
import type {
  AlternativaPregunta,
  DatosPregunta,
  OrigenPregunta,
} from './preguntas.validadores.js';

/** Etapa en que parte toda pregunta nueva (contenido.estado_pregunta con es_inicial). */
const ESTADO_INICIAL = 'borrador';

export interface AlternativaGuardada {
  id: string;
  letra: string;
  texto: string;
  esCorrecta: boolean;
  explicacion: string | null;
}

/** La pregunta como se guarda, con sus alternativas (incluida la correcta: es para la consola). */
export interface FilaPregunta {
  id: string;
  pruebaId: number;
  contenidoId: number;
  habilidadId: number;
  tipoPregunta: string;
  dificultadSugerida: string | null;
  enunciado: string;
  explicacion: string;
  textoEstimuloId: string | null;
  ordenEnTexto: number | null;
  estado: Opcion;
  /** La etapa permite editar (borrador u observada, RF-G09). */
  editable: boolean;
  version: number;
  origen: OrigenPregunta;
  alternativas: AlternativaGuardada[];
  actualizadoEn: Date;
}

export interface PreguntasEdicionRepositorio {
  /** Usuario que registran los triggers en el historial y las versiones, hasta el fin de la transacción. */
  fijarAutor(usuarioId: string, tx: Ejecutor): Promise<void>;
  /** Devuelve el id de la pregunta nueva, en la etapa inicial. */
  insertar(datos: DatosPregunta, autorId: string, tx: Ejecutor): Promise<string>;
  actualizar(id: string, datos: DatosPregunta, tx: Ejecutor): Promise<void>;
  /** Crea o cambia las alternativas por letra; las que no cambian no se tocan. */
  guardarAlternativas(id: string, alternativas: AlternativaPregunta[], tx: Ejecutor): Promise<void>;
  /** Quita las alternativas cuyas letras ya no vienen. */
  quitarAlternativas(id: string, letrasQueQuedan: string[], tx: Ejecutor): Promise<void>;
  /** La pregunta o null. `bloquear` la reserva (FOR UPDATE) hasta el fin de la transacción. */
  obtener(id: string, tx?: Ejecutor, bloquear?: boolean): Promise<FilaPregunta | null>;
  existeTexto(id: number, tx?: Ejecutor): Promise<boolean>;
}

const INSERTAR = `
  INSERT INTO contenido.pregunta (prueba_id, contenido_id, habilidad_id, tipo_pregunta_id,
                                  dificultad_sugerida_id, enunciado, explicacion, texto_estimulo_id,
                                  orden_en_texto, autor_id, estado_pregunta_id, creado_en, actualizado_en)
  VALUES ($1, $2, $3, (SELECT id FROM contenido.tipo_pregunta WHERE codigo = $4),
          (SELECT id FROM contenido.dificultad WHERE codigo = $5), $6, $7, $8, $9, $10,
          (SELECT id FROM contenido.estado_pregunta WHERE codigo = $11), now(), now())
  RETURNING id::text AS id`;

const ACTUALIZAR = `
  UPDATE contenido.pregunta
     SET prueba_id = $2, contenido_id = $3, habilidad_id = $4,
         tipo_pregunta_id = (SELECT id FROM contenido.tipo_pregunta WHERE codigo = $5),
         dificultad_sugerida_id = (SELECT id FROM contenido.dificultad WHERE codigo = $6),
         enunciado = $7, explicacion = $8, texto_estimulo_id = $9, orden_en_texto = $10,
         actualizado_en = now()
   WHERE id = $1`;

// ux_alternativa_una_correcta admite una sola correcta en todo momento: antes de marcar la nueva, se
// desmarca la que deja de serlo ($2 son las letras que quedan correctas).
const DESMARCAR_CORRECTA = `
  UPDATE contenido.alternativa SET es_correcta = false
   WHERE pregunta_id = $1 AND es_correcta AND NOT (letra = ANY ($2::text[]))`;

// El WHERE evita tocar (y versionar) una alternativa que no cambió: así el trigger no la ve.
const GUARDAR_ALTERNATIVAS = `
  INSERT INTO contenido.alternativa (pregunta_id, letra, texto, es_correcta, explicacion)
  SELECT $1, a.letra, a.texto, a.es_correcta, a.explicacion
    FROM unnest($2::text[], $3::text[], $4::boolean[], $5::text[])
         AS a (letra, texto, es_correcta, explicacion)
  ON CONFLICT (pregunta_id, letra) DO UPDATE
     SET texto = EXCLUDED.texto, es_correcta = EXCLUDED.es_correcta, explicacion = EXCLUDED.explicacion
   WHERE (alternativa.texto, alternativa.es_correcta, alternativa.explicacion)
         IS DISTINCT FROM (EXCLUDED.texto, EXCLUDED.es_correcta, EXCLUDED.explicacion)`;

const OBTENER = `
  SELECT p.id::text AS id, p.prueba_id AS "pruebaId", p.contenido_id AS "contenidoId",
         p.habilidad_id AS "habilidadId", tp.codigo AS "tipoPregunta", d.codigo AS "dificultadSugerida",
         p.enunciado, p.explicacion, p.texto_estimulo_id::text AS "textoEstimuloId",
         p.orden_en_texto AS "ordenEnTexto",
         json_build_object('codigo', ep.codigo, 'nombre', ep.nombre) AS estado, ep.editable,
         p.version, ${ORIGEN} AS origen, p.actualizado_en AS "actualizadoEn",
         COALESCE((SELECT json_agg(json_build_object('id', a.id::text, 'letra', a.letra, 'texto', a.texto,
                                                     'esCorrecta', a.es_correcta,
                                                     'explicacion', a.explicacion) ORDER BY a.letra)
                     FROM contenido.alternativa a WHERE a.pregunta_id = p.id), '[]') AS alternativas
    FROM contenido.pregunta p
    JOIN contenido.tipo_pregunta tp ON tp.id = p.tipo_pregunta_id
    JOIN contenido.estado_pregunta ep ON ep.id = p.estado_pregunta_id
    LEFT JOIN contenido.dificultad d ON d.id = p.dificultad_sugerida_id
   WHERE p.id = $1`;

/** Columnas de la pregunta en el orden de INSERTAR ($1 a $9) y de ACTUALIZAR ($2 a $10). */
const columnas = (datos: DatosPregunta) => [
  datos.pruebaId,
  datos.contenidoId,
  datos.habilidadId,
  datos.tipoPregunta,
  datos.dificultadSugerida,
  datos.enunciado,
  datos.explicacion,
  datos.textoEstimuloId,
  datos.ordenEnTexto,
];

/** Escrituras: la pregunta, sus alternativas y el autor para los triggers. */
function escrituras(): Omit<PreguntasEdicionRepositorio, 'obtener' | 'existeTexto'> {
  return {
    async fijarAutor(usuarioId, tx) {
      await tx.query("SELECT set_config('supera.usuario_id', $1, true)", [usuarioId]);
    },

    async insertar(datos, autorId, tx) {
      const { rows } = await tx.query<{ id: string }>(INSERTAR, [
        ...columnas(datos),
        autorId,
        ESTADO_INICIAL,
      ]);
      const id = rows[0]?.id;
      if (id === undefined) throw new Error('La pregunta no se guardó.');
      return id;
    },

    async actualizar(id, datos, tx) {
      await tx.query(ACTUALIZAR, [id, ...columnas(datos)]);
    },

    async guardarAlternativas(id, alternativas, tx) {
      const correctas = alternativas.filter((a) => a.esCorrecta).map((a) => a.letra);
      await tx.query(DESMARCAR_CORRECTA, [id, correctas]);
      await tx.query(GUARDAR_ALTERNATIVAS, [
        id,
        alternativas.map((a) => a.letra),
        alternativas.map((a) => a.texto),
        alternativas.map((a) => a.esCorrecta),
        alternativas.map((a) => a.explicacion),
      ]);
    },

    async quitarAlternativas(id, letrasQueQuedan, tx) {
      await tx.query(
        'DELETE FROM contenido.alternativa WHERE pregunta_id = $1 AND NOT (letra = ANY ($2::text[]))',
        [id, letrasQueQuedan],
      );
    },
  };
}

export function crearPreguntasEdicionRepositorio(bd: Ejecutor): PreguntasEdicionRepositorio {
  return {
    ...escrituras(),

    async obtener(id, tx = bd, bloquear = false) {
      const { rows } = await tx.query<FilaPregunta>(
        bloquear ? `${OBTENER} FOR UPDATE OF p` : OBTENER,
        [id],
      );
      return rows[0] ?? null;
    },

    async existeTexto(id, tx = bd) {
      const { rows } = await tx.query<{ existe: boolean }>(
        'SELECT EXISTS (SELECT 1 FROM contenido.texto_estimulo WHERE id = $1) AS existe',
        [id],
      );
      return rows[0]?.existe ?? false;
    },
  };
}
