// Reglas de negocio del módulo revision: asignaciones a docentes, revisiones con la pauta,
// desempate y clasificación de dificultad.
// Es la única puerta de entrada al módulo: los demás módulos usan este servicio, nunca su repositorio.
// HU-21 (CU-18 y CU-18a, RF-G06, RN-10): enviar una pregunta a revisión la pasa a en revisión y la
// asigna a los docentes del área que no son su autor ni quien pidió su lote, en una sola transacción:
// si no hay suficientes docentes, nada cambia y la pregunta sigue en su etapa.
import { ErrorConflicto, ErrorNoImplementado } from '../../comun/errores.js';
import type { Reloj } from '../../comun/reloj.js';
import type { Ejecutor, UnidadDeTrabajo } from '../../db/transaccion.js';
import type { AdministracionServicio } from '../administracion/index.js';
import type { PreguntasServicio } from '../preguntas/index.js';
import {
  type AsignacionNueva,
  crearRevisionRepositorio,
  type DocenteDisponible,
  type RevisionRepositorio,
} from './revision.repositorio.js';

export interface DependenciasRevisionServicio {
  bd: Ejecutor;
  unidadDeTrabajo: UnidadDeTrabajo;
  /** Hora de la asignación y su fecha límite. */
  reloj: Reloj;
  administracion: Pick<AdministracionServicio, 'obtenerParametroEntero' | 'registrarAuditoria'>;
  preguntas: Pick<PreguntasServicio, 'pasarARevision'>;
  /** Solo para pruebas: reemplaza al repositorio que se crea con crearRevisionRepositorio(bd). */
  repositorio?: RevisionRepositorio;
}

/** Un revisor asignado, con su fecha límite (RF-G17). */
export interface RevisorAsignado {
  asignacionId: string;
  docente: DocenteDisponible;
  venceEn: string;
}

/** La pregunta enviada a revisión: su ronda, la versión que se revisa y sus revisores. */
export interface EnvioARevision {
  preguntaId: string;
  ronda: number;
  version: number;
  revisores: RevisorAsignado[];
}

export interface RevisionServicio {
  /** HU-21: pasa la pregunta a en revisión y le asigna sus revisores (RN-10); sin docentes, 409. */
  enviarARevision(administradorId: string, preguntaId: string): Promise<EnvioARevision>;
  /** Asignaciones pendientes del docente (D01, HU-21 y HU-22). */
  listarMisRevisiones(): Promise<never>;
  /** Preguntas en desempate asignadas al docente (D02, HU-23). */
  listarDesempates(): Promise<never>;
  /** Seguimiento de las revisiones para el administrador (C06). */
  listarSeguimiento(): Promise<never>;
}

const DIA_EN_MS = 24 * 60 * 60 * 1000;

/** Parámetros de contenido.configuracion: cuántos revisores y en cuántos días vence la revisión. */
async function parametros({ administracion }: DependenciasRevisionServicio) {
  return {
    requeridos: await administracion.obtenerParametroEntero('revisores_requeridos'),
    dias: await administracion.obtenerParametroEntero('dias_plazo_revision'),
  };
}

/** CU-18a: los revisores de la pregunta, o el aviso de que el área no tiene docentes suficientes. */
async function elegirRevisores(
  repositorio: RevisionRepositorio,
  [preguntaId, requeridos]: [string, number],
  tx: Ejecutor,
): Promise<DocenteDisponible[]> {
  const disponibles = await repositorio.docentesDisponibles(preguntaId, tx);
  if (disponibles.length >= requeridos) return disponibles.slice(0, requeridos);
  const area = (await repositorio.areaDeLaPregunta(preguntaId, tx)) ?? 'su área';
  throw new ErrorConflicto(
    `La pregunta no tiene ${String(requeridos)} docentes de ${area} disponibles para revisarla: asigna el área a un docente en Usuarios internos.`,
  );
}

/** Cada asignación con los datos de su docente, en el orden en que se eligieron. */
function conDocentes(
  asignaciones: readonly AsignacionNueva[],
  docentes: readonly DocenteDisponible[],
): RevisorAsignado[] {
  return docentes.flatMap((docente) => {
    const asignacion = asignaciones.find((candidata) => candidata.docenteId === docente.id);
    return asignacion
      ? [{ asignacionId: asignacion.id, docente, venceEn: asignacion.venceEn.toISOString() }]
      : [];
  });
}

async function enviarARevision(
  dependencias: DependenciasRevisionServicio,
  repositorio: RevisionRepositorio,
  [administradorId, preguntaId]: [string, string],
): Promise<EnvioARevision> {
  const { requeridos, dias } = await parametros(dependencias);
  return dependencias.unidadDeTrabajo.enTransaccion(async (tx) => {
    const { version, ronda } = await dependencias.preguntas.pasarARevision(
      administradorId,
      preguntaId,
      tx,
    );
    const docentes = await elegirRevisores(repositorio, [preguntaId, requeridos], tx);
    const asignadoEn = dependencias.reloj();
    const asignaciones = await repositorio.asignarRevisores(
      {
        preguntaId,
        ronda,
        version,
        docenteIds: docentes.map((docente) => docente.id),
        asignadoEn,
        venceEn: new Date(asignadoEn.getTime() + dias * DIA_EN_MS),
      },
      tx,
    );
    const envio = { preguntaId, ronda, version, revisores: conDocentes(asignaciones, docentes) };
    await dependencias.administracion.registrarAuditoria(
      {
        usuarioId: administradorId,
        accion: 'enviar_a_revision',
        entidad: 'pregunta',
        entidadId: preguntaId,
        antes: null,
        despues: { ronda, version, revisores: docentes.map(({ id, correo }) => ({ id, correo })) },
      },
      tx,
    );
    return envio;
  });
}

export function crearRevisionServicio(
  dependencias: DependenciasRevisionServicio,
): RevisionServicio {
  const repositorio = dependencias.repositorio ?? crearRevisionRepositorio(dependencias.bd);
  return {
    enviarARevision: (administradorId, preguntaId) =>
      enviarARevision(dependencias, repositorio, [administradorId, preguntaId]),
    // Esqueleto: cada método se implementa en la historia de usuario correspondiente.
    listarMisRevisiones: () => Promise.reject(new ErrorNoImplementado('Mis revisiones')),
    listarDesempates: () => Promise.reject(new ErrorNoImplementado('Los desempates')),
    listarSeguimiento: () =>
      Promise.reject(new ErrorNoImplementado('El seguimiento de las revisiones')),
  };
}
