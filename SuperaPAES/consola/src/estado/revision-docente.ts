// Mis revisiones (D01, HU-22.2 y HU-22.3, CU-19): la bandeja del docente revisor (bandeja-docente.ts)
// con la pregunta a ciegas y la revisión con la pauta, la dificultad, la decisión y el motivo.
import { entregarRevision, listarMisRevisiones, obtenerMiRevision } from '../servicios/revision';
import type { PreguntaARevisar } from '../tipos';
import { type ApiDeBandeja, type EstadoBandejaDocente, useBandejaDocente } from './bandeja-docente';
import { armarRevision, validarRevision } from './formulario-revision';

const MIS_REVISIONES: ApiDeBandeja<PreguntaARevisar> = {
  listar: listarMisRevisiones,
  obtener: obtenerMiRevision,
  validar: validarRevision,
  entregar: (campos, pregunta) =>
    entregarRevision(pregunta.id, armarRevision(campos, pregunta.pauta)),
  aviso: (pregunta) => `Revisión de la pregunta ${String(pregunta.preguntaId)} entregada.`,
};

/** `asignacion` abre esa revisión al entrar (desde Clasificar dificultad, D03). */
export const useRevisionDocente = (asignacion: number | null = null) =>
  useBandejaDocente(MIS_REVISIONES, asignacion);

/** La asignación de `?asignacion=` si es un id válido; si no, null (abre la primera). */
export function asignacionDeLaConsulta(valor: string | null): number | null {
  if (!valor || !/^[1-9]\d{0,15}$/.test(valor)) return null;
  const id = Number(valor);
  return Number.isSafeInteger(id) ? id : null;
}

export type RevisionDocente = EstadoBandejaDocente<PreguntaARevisar>;
