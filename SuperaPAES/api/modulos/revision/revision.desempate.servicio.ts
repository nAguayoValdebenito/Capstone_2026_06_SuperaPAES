// Desempates del tercer docente (D02, HU-23, CU-20, RF-G08, RN-11 y RN-12): sus desempates pendientes,
// la pregunta como se envió a revisión con las dos revisiones de la ronda (sin decir quién las escribió) y
// su decisión, que deja la pregunta aprobada con la dificultad final, rechazada u observada. La marca de
// posiblemente confusa (fácil contra difícil) se avisa y se mantiene.
import { ErrorConflicto, ErrorNoEncontrado, ErrorValidacion } from '../../comun/errores.js';
import type { Reloj } from '../../comun/reloj.js';
import type { UnidadDeTrabajo } from '../../db/transaccion.js';
import type { PreguntasServicio } from '../preguntas/index.js';
import type { BandejaRepositorio } from './revision.bandeja.repositorio.js';
import {
  aPreguntaARevisar,
  opcionesDeLaPauta,
  type PreguntaARevisar,
  problemasDeLaDecision,
  type RevisionPendiente,
} from './revision.bandeja.servicio.js';
import type { DesempateRepositorio, RevisionDelRevisor } from './revision.desempate.repositorio.js';
import { combinarRevisiones } from './revision.reglas.js';
import type { DatosDesempate } from './revision.validadores.js';

/** La pregunta en desempate con las revisiones de la ronda y si es posiblemente confusa. */
export interface DesempateAbierto extends PreguntaARevisar {
  revisiones: RevisionDelRevisor[];
  posibleAmbigua: boolean;
}

/** El desempate entregado y la etapa en que queda la pregunta. */
export interface DesempateEntregado {
  asignacionId: string;
  preguntaId: string;
  decision: string;
  dificultad: string;
  estado: 'aprobada' | 'rechazada' | 'observada';
}

export interface DesempatesDocente {
  /** D02: los desempates pendientes del docente, la fecha límite más próxima primero. */
  listarDesempates(docenteId: string): Promise<RevisionPendiente[]>;
  /** 404 si el desempate no es del docente o ya lo entregó. */
  obtenerDesempate(docenteId: string, id: string): Promise<DesempateAbierto>;
  /** CU-20: 400 si falta la dificultad, la decisión o el motivo; 409 si ya lo entregó. */
  entregarDesempate(
    docenteId: string,
    id: string,
    datos: DatosDesempate,
  ): Promise<DesempateEntregado>;
}

export interface DependenciasDesempate {
  unidadDeTrabajo: UnidadDeTrabajo;
  reloj: Reloj;
  /** La bandeja de las asignaciones de desempate. */
  repositorio: BandejaRepositorio;
  revisiones: DesempateRepositorio;
  preguntas: Pick<PreguntasServicio, 'resolverRevision'>;
}

const NO_EXISTE = 'El desempate no existe o ya lo entregaste.';

/** La etapa en que deja la pregunta cada decisión del tercer docente. */
const ETAPA: Record<string, DesempateEntregado['estado'] | undefined> = {
  aprobar: 'aprobada',
  rechazar: 'rechazada',
  observar: 'observada',
};

async function obtenerDesempate(
  { repositorio, revisiones }: DependenciasDesempate,
  [docenteId, id]: [string, string],
): Promise<DesempateAbierto> {
  const fila = await repositorio.obtenerPendiente(id, docenteId);
  if (!fila) throw new ErrorNoEncontrado(NO_EXISTE);
  const [opciones, deLaRonda] = await Promise.all([
    opcionesDeLaPauta(repositorio),
    revisiones.revisionesDeLaRonda(id),
  ]);
  const { posibleAmbigua } = combinarRevisiones(
    deLaRonda.map((revision) => ({
      decision: revision.decision.codigo,
      dificultad: revision.dificultad.codigo,
    })),
  );
  return { ...aPreguntaARevisar(fila, opciones), revisiones: deLaRonda, posibleAmbigua };
}

async function entregarDesempate(
  { unidadDeTrabajo, reloj, repositorio, preguntas }: DependenciasDesempate,
  [docenteId, id]: [string, string],
  datos: DatosDesempate,
): Promise<DesempateEntregado> {
  const problemas = problemasDeLaDecision(datos, await opcionesDeLaPauta(repositorio));
  if (problemas.length > 0) throw new ErrorValidacion(problemas, problemas[0]?.mensaje);
  const estado = ETAPA[datos.decision];
  if (!estado) throw new Error(`La decisión ${datos.decision} no tiene etapa.`);
  return unidadDeTrabajo.enTransaccion(async (tx) => {
    const asignacion = await repositorio.reservarAsignacion(id, docenteId, tx);
    if (asignacion === null) throw new ErrorNoEncontrado(NO_EXISTE);
    if (asignacion.estado !== 'pendiente')
      throw new ErrorConflicto('Este desempate ya se entregó.');
    await repositorio.guardarRevision(
      { asignacionId: id, ...datos, criterios: [], entregadaEn: reloj() },
      tx,
    );
    const dificultad = estado === 'aprobada' ? datos.dificultad : null;
    await preguntas.resolverRevision(
      docenteId,
      asignacion.preguntaId,
      { estado, dificultad, posibleAmbigua: null },
      tx,
    );
    const { decision } = datos;
    return {
      asignacionId: id,
      preguntaId: asignacion.preguntaId,
      decision,
      dificultad: datos.dificultad,
      estado,
    };
  });
}

export function crearDesempatesDocente(dependencias: DependenciasDesempate): DesempatesDocente {
  const { repositorio } = dependencias;
  return {
    async listarDesempates(docenteId) {
      const filas = await repositorio.listarPendientes(docenteId);
      return filas.map((fila) => ({ ...fila, venceEn: fila.venceEn.toISOString() }));
    },
    obtenerDesempate: (docenteId, id) => obtenerDesempate(dependencias, [docenteId, id]),
    entregarDesempate: (docenteId, id, datos) =>
      entregarDesempate(dependencias, [docenteId, id], datos),
  };
}
