// Resolver la ronda de revisión (HU-23, CU-19 paso 7 y 7.a, RN-11 y RN-12): cuando el último revisor
// entrega, en su misma transacción, se combinan las revisiones (revision.reglas.ts) y el módulo
// preguntas deja la pregunta aprobada, rechazada u observada; si no coinciden, queda en desempate y se
// asigna un tercer docente del área (HU-23.2, RN-10) que no sea su autor, quien pidió su lote ni uno de
// los revisores. Sin un tercer docente disponible, la pregunta sigue en revisión con sus revisiones.
import type { Ejecutor } from '../../db/transaccion.js';
import type { PreguntasServicio } from '../preguntas/index.js';
import { combinarRevisiones, type Resolucion } from './revision.reglas.js';
import type {
  AsignacionDeLaRonda,
  ResolucionRepositorio,
} from './revision.resolucion.repositorio.js';
import type { RevisionRepositorio } from './revision.repositorio.js';

/** La hora de una asignación y su fecha límite (dias_plazo_revision). */
export interface Plazo {
  asignadoEn: Date;
  venceEn: Date;
}

export interface DependenciasResolucion {
  plazo: (tx: Ejecutor) => Promise<Plazo>;
  preguntas: Pick<PreguntasServicio, 'resolverRevision'>;
  repositorio: ResolucionRepositorio;
  revisores: Pick<RevisionRepositorio, 'reservarArea' | 'docentesDisponibles' | 'asignarRevisores'>;
}

/** HU-23.2: asigna el desempate al docente del área con menos carga que no está en la ronda. */
async function asignarDesempate(
  dependencias: DependenciasResolucion,
  [preguntaId, ronda]: [string, readonly AsignacionDeLaRonda[]],
  tx: Ejecutor,
): Promise<boolean> {
  const { revisores, plazo } = dependencias;
  await revisores.reservarArea(preguntaId, tx);
  const enLaRonda = new Set(ronda.map((asignacion) => asignacion.docenteId));
  const tercero = (await revisores.docentesDisponibles(preguntaId, tx)).find(
    (docente) => !enLaRonda.has(docente.id),
  );
  const primera = ronda[0];
  if (!tercero || !primera) return false;
  await revisores.asignarRevisores(
    {
      preguntaId,
      ronda: primera.ronda,
      version: primera.version,
      docenteIds: [tercero.id],
      ...(await plazo(tx)),
      rol: 'desempate',
    },
    tx,
  );
  return true;
}

/** El resultado para el módulo preguntas; con aprobada va la dificultad en que coincidieron. */
const resultado = (resolucion: Resolucion) => ({
  estado: resolucion.estado === 'desempate' ? ('en_desempate' as const) : resolucion.estado,
  dificultad: resolucion.estado === 'aprobada' ? resolucion.dificultad : null,
  posibleAmbigua: resolucion.posibleAmbigua,
});

/**
 * Resuelve la ronda vigente de la pregunta si ya entregaron todos sus revisores (y aún no hay tercer
 * docente). `docenteId` es quien entregó la última revisión: queda en el historial de la pregunta.
 */
export async function resolverRonda(
  dependencias: DependenciasResolucion,
  [docenteId, preguntaId]: [string, string],
  tx: Ejecutor,
): Promise<void> {
  const { repositorio, preguntas } = dependencias;
  await repositorio.reservarPregunta(preguntaId, tx);
  const ronda = await repositorio.asignacionesDeLaRonda(preguntaId, tx);
  const revisores = ronda.filter((asignacion) => asignacion.rol === 'revisor');
  const listos = revisores.flatMap(({ decision, dificultad }) =>
    decision !== null && dificultad !== null ? [{ decision, dificultad }] : [],
  );
  const yaEnDesempate = ronda.some((asignacion) => asignacion.rol === 'desempate');
  if (yaEnDesempate || listos.length === 0 || listos.length < revisores.length) return;
  const resolucion = combinarRevisiones(listos);
  if (resolucion.estado === 'desempate') {
    const asignado = await asignarDesempate(dependencias, [preguntaId, ronda], tx);
    if (!asignado) return;
  }
  await preguntas.resolverRevision(docenteId, preguntaId, resultado(resolucion), tx);
}
