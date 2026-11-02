// Formulario de la revisión docente (D01, HU-22.3, CU-19 pasos 3 a 5): cada punto de la pauta con «sí» o
// «no» (y la observación cuando no se cumple), la dificultad, la decisión y el motivo al observar o
// rechazar. Las mismas reglas que revisa la API, para avisar antes de enviar; la API decide igual.
import type { CriterioPauta, DatosRevision, PreguntaARevisar } from '../tipos';
import { detallesDeApi } from './detalles-de-api';
import { mensajeDeError } from './usuarios-internos';

export interface RespuestaCriterio {
  cumple: boolean | null;
  observacion: string;
}

export interface CamposRevision {
  criterios: Record<string, RespuestaCriterio>;
  dificultad: string | null;
  decision: string | null;
  comentario: string;
}

/**
 * Errores por campo: `criterios.<código>` para la observación de un punto, `criterios` para la pauta
 * completa y `general` para lo que no es de un campo (por ejemplo, una revisión ya entregada).
 */
export type ErroresRevision = Partial<Record<string, string>>;

export const camposVacios = (): CamposRevision => ({
  criterios: {},
  dificultad: null,
  decision: null,
  comentario: '',
});

/** La pauta completa: cada punto con «sí» o «no», y la observación de cada «no» (CU-19 paso 3). */
function erroresDeLaPauta(
  campos: CamposRevision,
  pauta: readonly CriterioPauta[],
): ErroresRevision {
  const errores: ErroresRevision = {};
  if (pauta.some((criterio) => campos.criterios[criterio.codigo]?.cumple == null)) {
    errores.criterios = `Responde los ${String(pauta.length)} puntos de la pauta.`;
  }
  for (const criterio of pauta) {
    const respuesta = campos.criterios[criterio.codigo];
    if (respuesta?.cumple === false && !respuesta.observacion.trim()) {
      errores[`criterios.${criterio.codigo}`] = 'Escribe por qué no se cumple.';
    }
  }
  return errores;
}

/** Lo que falta para entregar la revisión; vacío si está completa. */
export function validarRevision(
  campos: CamposRevision,
  pregunta: Pick<PreguntaARevisar, 'pauta' | 'decisiones'>,
): ErroresRevision {
  const errores = erroresDeLaPauta(campos, pregunta.pauta);
  if (!campos.dificultad) errores.dificultad = 'Elige la dificultad que asignas.';
  const decision = pregunta.decisiones.find((d) => d.codigo === campos.decision);
  if (!decision) errores.decision = 'Elige si apruebas, observas o rechazas la pregunta.';
  if (decision?.requiereComentario && !campos.comentario.trim()) {
    errores.comentario = `Escribe el motivo para ${decision.nombre.toLowerCase()} la pregunta.`;
  }
  return errores;
}

/** La revisión para la API, con los puntos en el orden de la pauta. Supone que validarRevision pasó. */
export function armarRevision(
  campos: CamposRevision,
  pauta: readonly CriterioPauta[],
): DatosRevision {
  return {
    criterios: pauta.map(({ codigo }) => {
      const respuesta = campos.criterios[codigo];
      const cumple = respuesta?.cumple === true;
      return { codigo, cumple, observacion: cumple ? null : respuesta?.observacion.trim() || null };
    }),
    dificultad: campos.dificultad ?? '',
    decision: campos.decision ?? '',
    comentario: campos.comentario.trim() || null,
  };
}

/** Cada problema de la API bajo su campo; lo que no es de un campo va arriba del formulario. */
export function erroresDeApi(error: unknown): ErroresRevision {
  const errores: ErroresRevision = {};
  for (const detalle of detallesDeApi(error)) errores[detalle.ruta] ??= detalle.mensaje;
  return Object.keys(errores).length > 0 ? errores : { general: mensajeDeError(error).mensaje };
}
