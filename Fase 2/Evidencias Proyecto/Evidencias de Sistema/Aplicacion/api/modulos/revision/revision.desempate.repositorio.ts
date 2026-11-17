// SQL del desempate (D02, HU-23, CU-20): las revisiones que entregaron los revisores en la ronda de la
// asignación del tercer docente, con su decisión, su dificultad, su motivo y cada punto de la pauta.
// No lee quién las escribió: el tercer docente las ve como «Revisión 1» y «Revisión 2». Lee por su
// código las listas rol_revision, decision_revision, dificultad y criterio_pauta. Consultas siempre
// parametrizadas.
import type { Ejecutor } from '../../db/transaccion.js';
import type { Criterio, OpcionRevision } from './revision.bandeja.repositorio.js';

/** Un punto de la pauta como lo respondió el revisor. */
export interface CriterioRespondido extends Criterio {
  cumple: boolean;
  observacion: string | null;
}

/** Lo que entregó un revisor de la ronda. */
export interface RevisionDelRevisor {
  decision: OpcionRevision;
  dificultad: OpcionRevision;
  comentario: string | null;
  criterios: CriterioRespondido[];
}

export interface DesempateRepositorio {
  /** Las revisiones de los revisores de la ronda de la asignación, en el orden en que se asignaron. */
  revisionesDeLaRonda(asignacionId: string, tx?: Ejecutor): Promise<RevisionDelRevisor[]>;
}

const REVISIONES_DE_LA_RONDA = `
  SELECT json_build_object('codigo', dr.codigo, 'nombre', dr.nombre) AS decision,
         json_build_object('codigo', d.codigo, 'nombre', d.nombre) AS dificultad,
         rv.comentario,
         COALESCE((SELECT json_agg(json_build_object('codigo', cp.codigo, 'descripcion', cp.descripcion,
                                                     'cumple', rc.cumple, 'observacion', rc.observacion)
                                   ORDER BY cp.orden)
                     FROM contenido.revision_criterio rc
                     JOIN contenido.criterio_pauta cp ON cp.id = rc.criterio_id
                    WHERE rc.revision_id = rv.id), '[]') AS criterios
    FROM contenido.asignacion_revision t
    JOIN contenido.asignacion_revision a ON (a.pregunta_id, a.ronda) = (t.pregunta_id, t.ronda)
    JOIN contenido.rol_revision r ON r.id = a.rol_revision_id AND r.codigo = 'revisor'
    JOIN contenido.revision rv ON rv.asignacion_id = a.id
    JOIN contenido.decision_revision dr ON dr.id = rv.decision_revision_id
    JOIN contenido.dificultad d ON d.id = rv.dificultad_id
   WHERE t.id = $1
   ORDER BY a.id`;

export function crearDesempateRepositorio(bd: Ejecutor): DesempateRepositorio {
  return {
    async revisionesDeLaRonda(asignacionId, tx = bd) {
      const { rows } = await tx.query<RevisionDelRevisor>(REVISIONES_DE_LA_RONDA, [asignacionId]);
      return rows;
    },
  };
}
