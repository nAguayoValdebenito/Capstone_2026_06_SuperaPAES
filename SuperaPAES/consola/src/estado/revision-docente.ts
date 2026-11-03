// Mis revisiones (D01, HU-22.2 y HU-22.3, CU-19): la bandeja del docente revisor (bandeja-docente.ts)
// con la pregunta a ciegas y la revisión con la pauta, la dificultad, la decisión y el motivo.
import { entregarRevision, listarMisRevisiones, obtenerMiRevision } from '../servicios/revision';
import type { PreguntaARevisar } from '../tipos';
import { type ApiDeBandeja, useBandejaDocente } from './bandeja-docente';
import { armarRevision, validarRevision } from './formulario-revision';

const MIS_REVISIONES: ApiDeBandeja<PreguntaARevisar> = {
  listar: listarMisRevisiones,
  obtener: obtenerMiRevision,
  validar: validarRevision,
  entregar: (campos, pregunta) =>
    entregarRevision(pregunta.id, armarRevision(campos, pregunta.pauta)),
  aviso: (pregunta) => `Revisión de la pregunta ${String(pregunta.preguntaId)} entregada.`,
};

export const useRevisionDocente = () => useBandejaDocente(MIS_REVISIONES);

export type RevisionDocente = ReturnType<typeof useRevisionDocente>;
