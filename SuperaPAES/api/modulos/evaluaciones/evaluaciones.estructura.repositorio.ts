import type { Ejecutor } from '../../db/transaccion.js';
import type {
  CandidataEstructura,
  DetalleEstructura,
  EstructuraConTiempo,
} from './evaluaciones.estructura.js';

const consultasEstructura = {
  async leer(
    tipo: 'mini_ensayo' | 'diagnostico',
    pruebaId: number,
    nivelId: number | null,
    tx: Ejecutor,
  ): Promise<EstructuraConTiempo | null> {
    const { rows } = await tx.query<EstructuraConTiempo>(
      `SELECT s.id,s.prueba_id AS "pruebaId",p.codigo,s.cantidad_min AS cantidad,
         s.duracion_min AS "duracionMin",s.textos FROM contenido.estructura_evaluacion s
         JOIN contenido.tipo_evaluacion t ON t.id=s.tipo_evaluacion_id
         JOIN contenido.prueba p ON p.id=s.prueba_id
         WHERE t.codigo=$2 AND s.prueba_id=$1 AND s.activa AND p.activa`,
      [pruebaId, tipo],
    );
    const estructura = rows[0];
    if (!estructura) return null;
    const detalle = await tx.query<DetalleEstructura>(
      `SELECT d.eje_id AS "ejeId",d.habilidad_id AS "habilidadId",d.es_electivo AS "esElectivo",d.cantidad,
         COALESCE(e.orden,h.id,32767) AS orden,
         (d.habilidad_id IS NOT NULL OR d.es_electivo OR EXISTS(SELECT 1 FROM contenido.contenido_tematico c
           LEFT JOIN contenido.nivel_escolar n ON n.id=c.nivel_escolar_id
           WHERE c.eje_id=d.eje_id AND c.activo AND (n.orden IS NULL OR $2::smallint IS NULL
             OR n.orden<=(SELECT orden FROM contenido.nivel_escolar WHERE id=$2)))) AS disponible
         FROM contenido.estructura_detalle d LEFT JOIN contenido.eje_tematico e ON e.id=d.eje_id
         LEFT JOIN contenido.habilidad h ON h.id=d.habilidad_id WHERE d.estructura_id=$1 ORDER BY orden`,
      [estructura.id, nivelId],
    );
    return { ...estructura, detalles: detalle.rows };
  },
  async candidatas(
    pruebaId: number,
    nivelId: number | null,
    tx: Ejecutor,
  ): Promise<CandidataEstructura[]> {
    const { rows } = await tx.query<CandidataEstructura>(
      `SELECT v.id::text AS "preguntaId",v.version,pv.eje_id AS "ejeId",pv.habilidad_id AS "habilidadId",
         c.area_id AS "areaId",d.codigo AS dificultad,v.texto_estimulo_id::text AS "textoId",v.orden_en_texto AS "ordenEnTexto"
         FROM contenido.v_preguntas_publicadas v
         JOIN contenido.pregunta_version pv ON (pv.pregunta_id,pv.version)=(v.id,v.version)
         JOIN contenido.contenido_tematico c ON c.id=pv.contenido_id
         JOIN contenido.dificultad d ON d.id=pv.dificultad_id
         LEFT JOIN contenido.nivel_escolar n ON n.id=c.nivel_escolar_id
         WHERE c.prueba_id=$1 AND c.activo AND (v.prueba='CL' OR $2::smallint IS NULL
           OR n.orden IS NULL OR n.orden<=(SELECT orden FROM contenido.nivel_escolar WHERE id=$2)) ORDER BY random()`,
      [pruebaId, nivelId],
    );
    return rows;
  },
};
export function crearEstructuraRepositorio() {
  return consultasEstructura;
}
