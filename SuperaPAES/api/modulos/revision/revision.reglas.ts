// Reglas que combinan las revisiones de una ronda (HU-23.1, CU-19 paso 7, RN-11 y RN-12, CP-16 pasos 1
// y 2) y la etapa en que deja la pregunta el tercer docente (CU-20). Usan los códigos de
// contenido.decision_revision (aprobar, observar, rechazar) y de contenido.dificultad (facil, media,
// dificil).

/** Lo que entregó cada revisor de la ronda. */
export interface RevisionDeLaRonda {
  decision: string;
  dificultad: string;
}

/** El resultado de combinar las revisiones; con aprobada va la dificultad en que coincidieron. */
export type Resolucion = { posibleAmbigua: boolean } & (
  { estado: 'aprobada'; dificultad: string } | { estado: 'rechazada' | 'observada' | 'desempate' }
);

/**
 * RN-11: si alguno observa, observada (vuelve al administrador); si todos rechazan, rechazada; si todos
 * aprueban con la misma dificultad, aprobada con esa dificultad; si no (uno aprueba y otro rechaza, o
 * aprueban con dificultades distintas), decide un tercer docente. RN-12: fácil contra difícil marca la
 * pregunta como posiblemente confusa.
 */
export function combinarRevisiones(revisiones: readonly RevisionDeLaRonda[]): Resolucion {
  const decisiones = new Set(revisiones.map((revision) => revision.decision));
  const dificultades = new Set(revisiones.map((revision) => revision.dificultad));
  const posibleAmbigua = dificultades.has('facil') && dificultades.has('dificil');
  if (decisiones.has('observar')) return { estado: 'observada', posibleAmbigua };
  const unanime = decisiones.size === 1;
  if (unanime && decisiones.has('rechazar')) return { estado: 'rechazada', posibleAmbigua };
  const [dificultad] = dificultades;
  if (unanime && decisiones.has('aprobar') && dificultades.size === 1 && dificultad) {
    return { estado: 'aprobada', dificultad, posibleAmbigua };
  }
  return { estado: 'desempate', posibleAmbigua };
}

/** La etapa en que queda la pregunta después del desempate. */
export type EtapaDelDesempate = 'aprobada' | 'rechazada' | 'observada';

const ETAPA_DEL_DESEMPATE: Record<string, EtapaDelDesempate | undefined> = {
  aprobar: 'aprobada',
  rechazar: 'rechazada',
  observar: 'observada',
};

/**
 * CU-20: la decisión del tercer docente es la final (aprobar, rechazar u observar); undefined si la
 * decisión no deja la pregunta en una etapa.
 */
export const etapaDelDesempate = (decision: string): EtapaDelDesempate | undefined =>
  ETAPA_DEL_DESEMPATE[decision];

/** Grupos del seguimiento de C06. */
export const GRUPOS_SEGUIMIENTO = ['en_curso', 'en_desempate', 'vencidas', 'terminadas'] as const;
export type GrupoSeguimiento = (typeof GRUPOS_SEGUIMIENTO)[number];

/** RN-15: una pregunta entra a la bandeja de calibración desde 30 intentos. */
export const INTENTOS_MINIMOS_CALIBRACION = 30;
