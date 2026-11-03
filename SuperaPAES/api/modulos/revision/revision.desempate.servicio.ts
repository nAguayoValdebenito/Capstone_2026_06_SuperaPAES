// Desempates del tercer docente (D02, HU-23, CU-20, RF-G08, RN-11 y RN-12): sus desempates pendientes,
// la pregunta como se envió a revisión con las dos revisiones de la ronda (sin decir quién las escribió) y
// su decisión, que deja la pregunta aprobada con la dificultad final, rechazada u observada. La marca de
// posiblemente confusa (fácil contra difícil) se avisa y se mantiene.
import { ErrorNoEncontrado, ErrorValidacion } from '../../comun/errores.js';
import type { Reloj } from '../../comun/reloj.js';
import type { UnidadDeTrabajo } from '../../db/transaccion.js';
import type { PreguntasServicio } from '../preguntas/index.js';
import type { BandejaRepositorio } from './revision.bandeja.repositorio.js';
import {
  aPreguntaAbierta,
  guardarEntrega,
  listarPendientes,
  opcionesDeLaDecision,
  type PreguntaARevisar,
  problemasDeLaDecision,
  type RevisionEntregada,
  type RevisionPendiente,
} from './revision.bandeja.servicio.js';
import type { DesempateRepositorio, RevisionDelRevisor } from './revision.desempate.repositorio.js';
import {
  combinarRevisiones,
  type EtapaDelDesempate,
  etapaDelDesempate,
} from './revision.reglas.js';
import type { DatosDesempate } from './revision.validadores.js';

/** La pregunta en desempate con las revisiones de la ronda y si es posiblemente confusa (sin pauta). */
export interface DesempateAbierto extends Omit<PreguntaARevisar, 'pauta'> {
  revisiones: RevisionDelRevisor[];
  posibleAmbigua: boolean;
}

/** El desempate entregado y la etapa en que queda la pregunta. */
export interface DesempateEntregado extends RevisionEntregada {
  estado: EtapaDelDesempate;
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

const DECISION_SIN_ETAPA = 'Elige si apruebas, observas o rechazas la pregunta.';

const MENSAJES = {
  noExiste: 'El desempate no existe o ya lo entregaste.',
  yaEntregada: 'Este desempate ya se entregó.',
};

async function obtenerDesempate(
  { repositorio, revisiones }: DependenciasDesempate,
  [docenteId, id]: [string, string],
): Promise<DesempateAbierto> {
  // Primero, que el desempate sea suyo y esté pendiente: solo entonces se leen las revisiones.
  const fila = await repositorio.obtenerPendiente(id, docenteId);
  if (!fila) throw new ErrorNoEncontrado(MENSAJES.noExiste);
  const [opciones, deLaRonda] = await Promise.all([
    opcionesDeLaDecision(repositorio),
    revisiones.revisionesDeLaRonda(id),
  ]);
  const { posibleAmbigua } = combinarRevisiones(
    deLaRonda.map((revision) => ({
      decision: revision.decision.codigo,
      dificultad: revision.dificultad.codigo,
    })),
  );
  return { ...aPreguntaAbierta(fila), ...opciones, revisiones: deLaRonda, posibleAmbigua };
}

/** La decisión es de la lista y deja la pregunta en una etapa; si no, 400. */
async function validarDesempate(repositorio: BandejaRepositorio, datos: DatosDesempate) {
  const problemas = problemasDeLaDecision(datos, await opcionesDeLaDecision(repositorio));
  const estado = etapaDelDesempate(datos.decision);
  if (!estado && problemas.length === 0) {
    problemas.push({ lugar: 'cuerpo', ruta: 'decision', mensaje: DECISION_SIN_ETAPA });
  }
  if (problemas.length > 0 || !estado) throw new ErrorValidacion(problemas, problemas[0]?.mensaje);
  return estado;
}

async function entregarDesempate(
  dependencias: DependenciasDesempate,
  [docenteId, id]: [string, string],
  datos: DatosDesempate,
): Promise<DesempateEntregado> {
  const estado = await validarDesempate(dependencias.repositorio, datos);
  const { decision, dificultad, comentario } = datos;
  const preguntaId = await guardarEntrega(dependencias, {
    docenteId,
    revision: {
      asignacionId: id,
      decision,
      dificultad,
      comentario,
      criterios: [],
      entregadaEn: dependencias.reloj(),
    },
    mensajes: MENSAJES,
    alGuardar: (pregunta, tx) =>
      dependencias.preguntas.resolverRevision(
        docenteId,
        pregunta,
        { estado, dificultad: estado === 'aprobada' ? dificultad : null, posibleAmbigua: null },
        tx,
      ),
  });
  return { asignacionId: id, preguntaId, decision, dificultad, estado };
}

export function crearDesempatesDocente(dependencias: DependenciasDesempate): DesempatesDocente {
  return {
    listarDesempates: (docenteId) => listarPendientes(dependencias.repositorio, docenteId),
    obtenerDesempate: (docenteId, id) => obtenerDesempate(dependencias, [docenteId, id]),
    entregarDesempate: (docenteId, id, datos) =>
      entregarDesempate(dependencias, [docenteId, id], datos),
  };
}
