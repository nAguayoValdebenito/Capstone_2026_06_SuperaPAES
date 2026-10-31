import type { Ejecutor } from '../../db/transaccion.js';
import type { EstructuraConTiempo } from './evaluaciones.estructura.js';
import type { PreguntaSeleccionada } from './evaluaciones.seleccion.tipos.js';

export interface AbiertaParaInicio {
  id: string;
  tipo: string;
  pruebaId: number;
  conTiempo: boolean;
  venceEn: Date | null;
}
export interface PreguntaConTiempo {
  id: string;
  orden: number;
  enunciado: string;
  texto: { titulo: string | null; contenido: string | null; imagen: string | null } | null;
  alternativas: { id: number | string; letra: string; texto: string }[];
  alternativaElegidaId: string | null;
  respondidaEn: Date | null;
}

interface NuevaConTiempo {
  estudianteId: string;
  estructura: EstructuraConTiempo;
  ahora: Date;
  preguntas: PreguntaSeleccionada[];
  electivoId: number | null;
}
const consultasConTiempo = {
  async contexto(anioEgreso: number, tx: Ejecutor) {
    const { rows } = await tx.query<{ ahora: Date; nivelId: number | null }>(
      `SELECT instante AS ahora,app.nivel_escolar_en($1,(instante AT TIME ZONE 'America/Santiago')::date) AS "nivelId"
         FROM (SELECT clock_timestamp() AS instante) reloj`,
      [anioEgreso],
    );
    return rows[0]!;
  },
  async abierta(estudianteId: string, tx: Ejecutor): Promise<AbiertaParaInicio | null> {
    const { rows } = await tx.query<AbiertaParaInicio>(
      `SELECT e.id::text,t.codigo AS tipo,e.prueba_id AS "pruebaId",t.con_tiempo AS "conTiempo",e.vence_en AS "venceEn"
         FROM app.evaluacion e JOIN contenido.tipo_evaluacion t ON t.id=e.tipo_evaluacion_id
         WHERE e.estudiante_id=$1 AND e.cerrada_en IS NULL FOR UPDATE OF e`,
      [estudianteId],
    );
    return rows[0] ?? null;
  },
  async crear(
    { estudianteId, estructura, ahora, preguntas, electivoId }: NuevaConTiempo,
    tx: Ejecutor,
  ): Promise<string> {
    const { rows } = await tx.query<{ id: string }>(
      `INSERT INTO app.evaluacion (estudiante_id,tipo_evaluacion_id,unica_por_anio_escolar,prueba_id,estructura_id,
          anio_escolar,cantidad_preguntas,duracion_min,estado_evaluacion_id,iniciada_en,vence_en,electivo_area_id)
         SELECT $1,t.id,false,$2,$3,0,$4,$5::smallint,e.id,$6::timestamptz,$6::timestamptz+$5::smallint*INTERVAL '1 minute',$7
         FROM contenido.tipo_evaluacion t,contenido.estado_evaluacion e
         WHERE t.codigo='mini_ensayo' AND e.codigo='en_curso' RETURNING id::text`,
      [
        estudianteId,
        estructura.pruebaId,
        estructura.id,
        preguntas.length,
        estructura.duracionMin,
        ahora,
        electivoId,
      ],
    );
    const id = rows[0]!.id;
    await tx.query(
      `INSERT INTO app.evaluacion_item (evaluacion_id,prueba_id,pregunta_id,version_pregunta,orden,entregada_en)
         SELECT $1,$2,p.id,p.version,p.orden,$5 FROM unnest($3::bigint[],$4::int[]) WITH ORDINALITY p(id,version,orden)`,
      [
        id,
        estructura.pruebaId,
        preguntas.map((p) => p.preguntaId),
        preguntas.map((p) => p.version),
        ahora,
      ],
    );
    return id;
  },
  async preguntas(id: string, estudianteId: string, tx: Ejecutor): Promise<PreguntaConTiempo[]> {
    const { rows } = await tx.query<PreguntaConTiempo>(
      `SELECT evaluacion_item_id::text AS id,orden,enunciado,
         CASE WHEN texto_titulo IS NOT NULL OR texto_contenido IS NOT NULL OR texto_imagen_url IS NOT NULL
          THEN jsonb_build_object('titulo',texto_titulo,'contenido',texto_contenido,'imagen',texto_imagen_url) END AS texto,
         alternativas,alternativa_elegida::text AS "alternativaElegidaId",respondida_en AS "respondidaEn"
         FROM app.v_item_evaluacion WHERE evaluacion_id=$1 AND estudiante_id=$2 ORDER BY orden`,
      [id, estudianteId],
    );
    return rows;
  },
};
export function crearConTiempoRepositorio() {
  return consultasConTiempo;
}
