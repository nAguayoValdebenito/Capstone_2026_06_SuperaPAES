// Reglas de negocio del módulo revision: asignaciones a docentes, revisiones con la pauta,
// desempate y clasificación de dificultad.
// Es la única puerta de entrada al módulo: los demás módulos usan este servicio, nunca su repositorio.
// HU-21 (CU-18 y CU-18a, RF-G06, RN-10): enviar una pregunta a revisión la pasa a en revisión y la
// asigna a los docentes del área que no son su autor ni quien pidió su lote, en una sola transacción:
// si no hay suficientes docentes, nada cambia y la pregunta sigue en su etapa. La bandeja del docente y
// la entrega de su revisión con la pauta (HU-22) están en revision.bandeja.servicio.ts; al entregar la
// última de la ronda se combinan las revisiones (HU-23, revision.resolucion.servicio.ts).
import { ErrorConflicto, ErrorNoImplementado } from '../../comun/errores.js';
import type { Reloj } from '../../comun/reloj.js';
import type { Ejecutor, UnidadDeTrabajo } from '../../db/transaccion.js';
import type { AdministracionServicio } from '../administracion/index.js';
import type { PreguntasServicio } from '../preguntas/index.js';
import {
  type BandejaRepositorio,
  crearBandejaRepositorio,
} from './revision.bandeja.repositorio.js';
import { type BandejaDocente, crearBandejaDocente } from './revision.bandeja.servicio.js';
import {
  crearResolucionRepositorio,
  type ResolucionRepositorio,
} from './revision.resolucion.repositorio.js';
import { type Plazo, resolverRonda } from './revision.resolucion.servicio.js';
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
  preguntas: Pick<PreguntasServicio, 'pasarARevision' | 'resolverRevision'>;
  /** Solo para pruebas: reemplaza al repositorio que se crea con crearRevisionRepositorio(bd). */
  repositorio?: RevisionRepositorio;
  /** Solo para pruebas: reemplaza al de crearBandejaRepositorio(bd). */
  repositorioBandeja?: BandejaRepositorio;
  /** Solo para pruebas: reemplaza al de crearResolucionRepositorio(). */
  repositorioResolucion?: ResolucionRepositorio;
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

/** HU-22: la bandeja del docente revisor (D01). */
export interface RevisionServicio extends BandejaDocente {
  /** HU-21: pasa la pregunta a en revisión y le asigna sus revisores (RN-10); sin docentes, 409. */
  enviarARevision(administradorId: string, preguntaId: string): Promise<EnvioARevision>;
  /** Preguntas en desempate asignadas al docente (D02, HU-23). */
  listarDesempates(): Promise<never>;
  /** Seguimiento de las revisiones para el administrador (C06). */
  listarSeguimiento(): Promise<never>;
}

const DIA_EN_MS = 24 * 60 * 60 * 1000;

/**
 * Parámetros de contenido.configuracion: cuántos revisores y en cuántos días vence la revisión. Un valor
 * menor que 1 dejaría una pregunta en revisión sin revisores o con el plazo vencido: no se usa.
 */
async function parametros({ administracion }: DependenciasRevisionServicio) {
  const requeridos = await administracion.obtenerParametroEntero('revisores_requeridos');
  const dias = await administracion.obtenerParametroEntero('dias_plazo_revision');
  if (requeridos < 1 || dias < 1) {
    throw new Error(
      'contenido.configuracion debe tener revisores_requeridos y dias_plazo_revision de al menos 1.',
    );
  }
  return { requeridos, dias };
}

/** La hora de la asignación y su fecha límite, desde ahora. */
async function plazo(dependencias: DependenciasRevisionServicio): Promise<Plazo> {
  const { dias } = await parametros(dependencias);
  const asignadoEn = dependencias.reloj();
  return { asignadoEn, venceEn: new Date(asignadoEn.getTime() + dias * DIA_EN_MS) };
}

/** CU-18a: los revisores de la pregunta, o el aviso de que el área no tiene docentes suficientes. */
async function elegirRevisores(
  repositorio: RevisionRepositorio,
  [preguntaId, requeridos]: [string, number],
  tx: Ejecutor,
): Promise<DocenteDisponible[]> {
  await repositorio.reservarArea(preguntaId, tx);
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
  const porDocente = new Map(asignaciones.map((asignacion) => [asignacion.docenteId, asignacion]));
  // Cada docente elegido recibe su asignación en la misma transacción.
  return docentes.flatMap((docente) => {
    const asignacion = porDocente.get(docente.id);
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
  const resolucion = {
    plazo: () => plazo(dependencias),
    preguntas: dependencias.preguntas,
    repositorio: dependencias.repositorioResolucion ?? crearResolucionRepositorio(),
    revisores: repositorio,
  };
  const bandeja = crearBandejaDocente({
    unidadDeTrabajo: dependencias.unidadDeTrabajo,
    reloj: dependencias.reloj,
    repositorio: dependencias.repositorioBandeja ?? crearBandejaRepositorio(dependencias.bd),
    alEntregar: (docenteId, preguntaId, tx) =>
      resolverRonda(resolucion, [docenteId, preguntaId], tx),
  });
  return {
    ...bandeja,
    enviarARevision: (administradorId, preguntaId) =>
      enviarARevision(dependencias, repositorio, [administradorId, preguntaId]),
    // Esqueleto: cada método se implementa en la historia de usuario correspondiente.
    listarDesempates: () => Promise.reject(new ErrorNoImplementado('Los desempates')),
    listarSeguimiento: () =>
      Promise.reject(new ErrorNoImplementado('El seguimiento de las revisiones')),
  };
}
