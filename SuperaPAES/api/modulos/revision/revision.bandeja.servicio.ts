// Bandeja del docente revisor (D01, HU-22, CU-19, RF-G07): sus revisiones pendientes, la pregunta como se
// envió a revisión y la entrega de su revisión con la pauta, la dificultad y la decisión.
// Revisión a ciegas (HU-22 esc. 3, RN-12): el docente no recibe la dificultad sugerida ni la revisión del
// otro docente. Al entregar la última revisión de la ronda, `alEntregar` combina las revisiones en la
// misma transacción (HU-23, revision.resolucion.servicio.ts).
import { ErrorConflicto, ErrorNoEncontrado, ErrorValidacion } from '../../comun/errores.js';
import type { ProblemaDeCampo } from '../../comun/middleware/validacion.js';
import type { Reloj } from '../../comun/reloj.js';
import type { Ejecutor, UnidadDeTrabajo } from '../../db/transaccion.js';
import type {
  BandejaRepositorio,
  Criterio,
  Decision,
  FilaRevisionAbierta,
  OpcionRevision,
  RevisionNueva,
} from './revision.bandeja.repositorio.js';
import type { DatosRevision } from './revision.validadores.js';

/** Una revisión pendiente en la bandeja (D01). */
export interface RevisionPendiente {
  id: string;
  preguntaId: string;
  ronda: number;
  prueba: { codigo: string; nombre: string };
  contenido: string;
  venceEn: string;
}

/** La pregunta que revisa el docente, con la correcta y la explicación, y las opciones de la pauta. */
export interface PreguntaARevisar extends RevisionPendiente {
  eje: string;
  habilidad: string;
  enunciado: string;
  explicacion: string;
  alternativas: {
    id: string;
    letra: string;
    texto: string;
    explicacion: string | null;
    esCorrecta: boolean;
  }[];
  texto: FilaRevisionAbierta['texto'];
  pauta: Criterio[];
  dificultades: OpcionRevision[];
  decisiones: Decision[];
}

/** La revisión entregada. */
export interface RevisionEntregada {
  asignacionId: string;
  preguntaId: string;
  decision: string;
  dificultad: string;
}

export interface BandejaDocente {
  listarMisRevisiones(docenteId: string): Promise<RevisionPendiente[]>;
  /** 404 si la revisión no es del docente o ya la entregó. */
  obtenerMiRevision(docenteId: string, id: string): Promise<PreguntaARevisar>;
  /** CU-19 pasos 3 a 6: 400 si falta algo de la pauta; 409 si ya la entregó. */
  entregarRevision(docenteId: string, id: string, datos: DatosRevision): Promise<RevisionEntregada>;
}

export interface DependenciasBandeja {
  unidadDeTrabajo: UnidadDeTrabajo;
  reloj: Reloj;
  repositorio: BandejaRepositorio;
  /** Después de guardar la revisión, en su transacción: resuelve la ronda si era la última (HU-23). */
  alEntregar: (docenteId: string, preguntaId: string, tx: Ejecutor) => Promise<void>;
}

const NO_EXISTE = 'La revisión no existe o ya la entregaste.';

const problema = (ruta: string, mensaje: string): ProblemaDeCampo => ({
  lugar: 'cuerpo',
  ruta,
  mensaje,
});

/** Las listas de dificultad y decisión (también para el desempate, D02). */
export async function opcionesDeLaDecision(repositorio: BandejaRepositorio) {
  const [dificultades, decisiones] = await Promise.all([
    repositorio.listarDificultades(),
    repositorio.listarDecisiones(),
  ]);
  return { dificultades, decisiones };
}

async function opcionesDeLaPauta(repositorio: BandejaRepositorio) {
  const [pauta, opciones] = await Promise.all([
    repositorio.listarCriterios(),
    opcionesDeLaDecision(repositorio),
  ]);
  return { pauta, ...opciones };
}

/** La pregunta de la asignación tal como se envió a revisión, sin las opciones del formulario. */
export function aPreguntaAbierta({
  copia,
  correctaId,
  ...fila
}: FilaRevisionAbierta): Omit<PreguntaARevisar, 'pauta' | 'dificultades' | 'decisiones'> {
  return {
    ...fila,
    venceEn: fila.venceEn.toISOString(),
    enunciado: copia.enunciado,
    explicacion: copia.explicacion,
    alternativas: copia.alternativas.map((alternativa) => ({
      ...alternativa,
      id: String(alternativa.id),
      esCorrecta: String(alternativa.id) === correctaId,
    })),
  };
}

/** Las asignaciones pendientes del docente en la bandeja, la fecha límite más próxima primero. */
export async function listarPendientes(
  repositorio: BandejaRepositorio,
  docenteId: string,
): Promise<RevisionPendiente[]> {
  const filas = await repositorio.listarPendientes(docenteId);
  return filas.map((fila) => ({ ...fila, venceEn: fila.venceEn.toISOString() }));
}

/** La revisión que entrega el docente, los mensajes de 404 y 409, y lo que sigue al guardarla. */
export interface Entrega {
  docenteId: string;
  revision: RevisionNueva;
  mensajes: { noExiste: string; yaEntregada: string };
  alGuardar: (preguntaId: string, tx: Ejecutor) => Promise<void>;
}

/**
 * CU-19 paso 6 y CU-20: reserva la asignación pendiente del docente, guarda su revisión y, en la misma
 * transacción, sigue con `alGuardar`. Devuelve la pregunta; 404 si no es suya y 409 si ya la entregó.
 */
export function guardarEntrega(
  { unidadDeTrabajo, repositorio }: Pick<DependenciasBandeja, 'unidadDeTrabajo' | 'repositorio'>,
  { docenteId, revision, mensajes, alGuardar }: Entrega,
): Promise<string> {
  return unidadDeTrabajo.enTransaccion(async (tx) => {
    const asignacion = await repositorio.reservarAsignacion(revision.asignacionId, docenteId, tx);
    if (asignacion === null) throw new ErrorNoEncontrado(mensajes.noExiste);
    if (asignacion.estado !== 'pendiente') throw new ErrorConflicto(mensajes.yaEntregada);
    await repositorio.guardarRevision(revision, tx);
    await alGuardar(asignacion.preguntaId, tx);
    return asignacion.preguntaId;
  });
}

/** Los puntos de la pauta: todos, una vez cada uno, con la observación de cada «no» (CU-19 paso 3). */
function problemasDeLaPauta(datos: DatosRevision, pauta: readonly Criterio[]): ProblemaDeCampo[] {
  const respondidos = new Map(datos.criterios.map((criterio) => [criterio.codigo, criterio]));
  // Tantas respuestas como puntos y todos respondidos: no hay repetidos ni puntos ajenos a la pauta.
  if (
    datos.criterios.length !== pauta.length ||
    pauta.some((criterio) => !respondidos.has(criterio.codigo))
  ) {
    return [problema('criterios', `Responde los ${String(pauta.length)} puntos de la pauta.`)];
  }
  return pauta.flatMap((criterio) => {
    const respuesta = respondidos.get(criterio.codigo);
    return respuesta && !respuesta.cumple && !respuesta.observacion
      ? [
          problema(
            `criterios.${criterio.codigo}`,
            `Escribe por qué no se cumple: «${criterio.descripcion}»`,
          ),
        ]
      : [];
  });
}

/**
 * CU-19 pasos 4 y 5 (y CU-20): la dificultad y la decisión existen, y el motivo cuando la decisión lo
 * pide (5.a).
 */
export function problemasDeLaDecision(
  datos: Pick<DatosRevision, 'dificultad' | 'decision' | 'comentario'>,
  { dificultades, decisiones }: Pick<PreguntaARevisar, 'dificultades' | 'decisiones'>,
): ProblemaDeCampo[] {
  const problemas: ProblemaDeCampo[] = [];
  if (!dificultades.some((d) => d.codigo === datos.dificultad)) {
    problemas.push(problema('dificultad', 'Elige la dificultad: fácil, media o difícil.'));
  }
  const decision = decisiones.find((candidata) => candidata.codigo === datos.decision);
  if (!decision) {
    problemas.push(problema('decision', 'Elige si apruebas, observas o rechazas la pregunta.'));
  }
  if (decision?.requiereComentario && !datos.comentario) {
    const motivo = `Escribe el motivo para ${decision.nombre.toLowerCase()} la pregunta.`;
    problemas.push(problema('comentario', motivo));
  }
  return problemas;
}

async function entregarRevision(
  dependencias: DependenciasBandeja,
  [docenteId, id]: [string, string],
  datos: DatosRevision,
): Promise<RevisionEntregada> {
  const opciones = await opcionesDeLaPauta(dependencias.repositorio);
  const problemas = [
    ...problemasDeLaPauta(datos, opciones.pauta),
    ...problemasDeLaDecision(datos, opciones),
  ];
  if (problemas.length > 0) throw new ErrorValidacion(problemas, problemas[0]?.mensaje);
  const { decision, dificultad, comentario, criterios } = datos;
  const preguntaId = await guardarEntrega(dependencias, {
    docenteId,
    revision: {
      asignacionId: id,
      decision,
      dificultad,
      comentario,
      criterios,
      entregadaEn: dependencias.reloj(),
    },
    mensajes: { noExiste: NO_EXISTE, yaEntregada: 'Esta revisión ya se entregó.' },
    alGuardar: (pregunta, tx) => dependencias.alEntregar(docenteId, pregunta, tx),
  });
  return { asignacionId: id, preguntaId, decision, dificultad };
}

export function crearBandejaDocente(dependencias: DependenciasBandeja): BandejaDocente {
  const { repositorio } = dependencias;
  return {
    listarMisRevisiones: (docenteId) => listarPendientes(repositorio, docenteId),
    async obtenerMiRevision(docenteId, id) {
      const fila = await repositorio.obtenerPendiente(id, docenteId);
      if (!fila) throw new ErrorNoEncontrado(NO_EXISTE);
      return { ...aPreguntaAbierta(fila), ...(await opcionesDeLaPauta(repositorio)) };
    },
    entregarRevision: (docenteId, id, datos) =>
      entregarRevision(dependencias, [docenteId, id], datos),
  };
}
