// Clasificar dificultad del banco semilla (D03, HU-25, CU-19a que extiende CU-19, RF-G12).
// La clasificación rápida es la revisión del docente asignado como revisor de una pregunta importada
// (CU-18 7.a): un clic entrega su revisión de la ronda con esa dificultad, la decisión «aprobar» y todos
// los puntos de la pauta cumplidos. Cuenta como uno de los dos revisores (RN-10) y, si es la última de la
// ronda, `alEntregar` combina las revisiones en la misma transacción (RN-11 y RN-12, igual que D01). Para
// observar o rechazar, el docente abre la misma asignación en D01. A ciegas: sin la dificultad sugerida.
import { ErrorValidacion } from '../../comun/errores.js';
import type { Reloj } from '../../comun/reloj.js';
import type { Ejecutor, UnidadDeTrabajo } from '../../db/transaccion.js';
import type { BandejaRepositorio } from './revision.bandeja.repositorio.js';
import {
  aPreguntaAbierta,
  guardarEntrega,
  opcionesDeLaDecision,
  type PreguntaARevisar,
  problemasDeLaDecision,
} from './revision.bandeja.servicio.js';
import type { ClasificacionRepositorio } from './revision.clasificacion.repositorio.js';

/** La pregunta que se clasifica: como en D01, con las dificultades y sin la pauta ni las decisiones. */
export type PreguntaAClasificar = Omit<PreguntaARevisar, 'pauta' | 'decisiones'>;

/** La pregunta que sigue (null si no queda ninguna) y cuántas quedan. */
export interface SiguienteAClasificar {
  pregunta: PreguntaAClasificar | null;
  quedan: number;
}

/** La clasificación guardada y lo que sigue. */
export interface DificultadClasificada {
  guardada: { asignacionId: string; preguntaId: string; dificultad: string };
  siguiente: SiguienteAClasificar;
}

export interface ClasificacionDocente {
  /** La siguiente por clasificar; con `despuesDe`, la que sigue a esa asignación (saltar). */
  siguienteAClasificar(docenteId: string, despuesDe: string | null): Promise<SiguienteAClasificar>;
  /** 400 si la dificultad no existe; 404 si no es suya o no es importada; 409 si ya la entregó. */
  clasificarDificultad(
    docenteId: string,
    id: string,
    dificultad: string,
  ): Promise<DificultadClasificada>;
}

export interface DependenciasClasificacion {
  unidadDeTrabajo: UnidadDeTrabajo;
  reloj: Reloj;
  /** La bandeja del revisor (D01): la pauta, las dificultades y guardar la revisión. */
  bandeja: BandejaRepositorio;
  repositorio: ClasificacionRepositorio;
  alEntregar: (docenteId: string, preguntaId: string, tx: Ejecutor) => Promise<void>;
}

const MENSAJES = {
  noExiste: 'La pregunta no existe o ya la clasificaste.',
  yaEntregada: 'Esta pregunta ya se clasificó.',
};

async function siguienteAClasificar(
  { bandeja, repositorio }: DependenciasClasificacion,
  [docenteId, despuesDe]: [string, string | null],
): Promise<SiguienteAClasificar> {
  const [fila, quedan] = await Promise.all([
    repositorio.siguiente(docenteId, despuesDe),
    repositorio.contarPendientes(docenteId),
  ]);
  if (!fila) return { pregunta: null, quedan };
  const dificultades = await bandeja.listarDificultades();
  return { pregunta: { ...aPreguntaAbierta(fila), dificultades }, quedan };
}

async function clasificarDificultad(
  dependencias: DependenciasClasificacion,
  [docenteId, id]: [string, string],
  dificultad: string,
): Promise<DificultadClasificada> {
  const { bandeja, repositorio } = dependencias;
  const [pauta, opciones] = await Promise.all([
    bandeja.listarCriterios(),
    opcionesDeLaDecision(bandeja),
  ]);
  const decision = 'aprobar';
  const problemas = problemasDeLaDecision({ dificultad, decision, comentario: null }, opciones);
  if (problemas.length > 0) throw new ErrorValidacion(problemas, problemas[0]?.mensaje);
  const preguntaId = await guardarEntrega(
    {
      unidadDeTrabajo: dependencias.unidadDeTrabajo,
      // Solo las asignaciones de preguntas importadas: las demás se revisan en D01.
      repositorio: {
        ...bandeja,
        reservarAsignacion: (asignacion, docente, tx) =>
          repositorio.reservarAsignacion(asignacion, docente, tx),
      },
    },
    {
      docenteId,
      revision: {
        asignacionId: id,
        decision,
        dificultad,
        comentario: null,
        criterios: pauta.map(({ codigo }) => ({ codigo, cumple: true, observacion: null })),
        entregadaEn: dependencias.reloj(),
      },
      mensajes: MENSAJES,
      alGuardar: (pregunta, tx) => dependencias.alEntregar(docenteId, pregunta, tx),
    },
  );
  return {
    guardada: { asignacionId: id, preguntaId, dificultad },
    siguiente: await siguienteAClasificar(dependencias, [docenteId, id]),
  };
}

export function crearClasificacionDocente(
  dependencias: DependenciasClasificacion,
): ClasificacionDocente {
  return {
    siguienteAClasificar: (docenteId, despuesDe) =>
      siguienteAClasificar(dependencias, [docenteId, despuesDe]),
    clasificarDificultad: (docenteId, id, dificultad) =>
      clasificarDificultad(dependencias, [docenteId, id], dificultad),
  };
}
