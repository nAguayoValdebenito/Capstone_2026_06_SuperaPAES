// Bandeja del docente revisor (D01, HU-22, CU-19, RF-G07): sus revisiones pendientes, la pregunta como se
// envió a revisión y la entrega de su revisión con la pauta, la dificultad y la decisión.
// Revisión a ciegas (HU-22 esc. 3, RN-12): el docente no recibe la dificultad sugerida ni la revisión del
// otro docente. Combinar las dos revisiones (aprobar, rechazar, observar o desempatar) es de HU-23.
import { ErrorConflicto, ErrorNoEncontrado, ErrorValidacion } from '../../comun/errores.js';
import type { ProblemaDeCampo } from '../../comun/middleware/validacion.js';
import type { Reloj } from '../../comun/reloj.js';
import type { UnidadDeTrabajo } from '../../db/transaccion.js';
import type {
  BandejaRepositorio,
  Criterio,
  Decision,
  FilaRevisionAbierta,
  OpcionRevision,
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
}

const NO_EXISTE = 'La revisión no existe o ya la entregaste.';

const problema = (ruta: string, mensaje: string): ProblemaDeCampo => ({
  lugar: 'cuerpo',
  ruta,
  mensaje,
});

async function opcionesDeLaPauta(repositorio: BandejaRepositorio) {
  return {
    pauta: await repositorio.listarCriterios(),
    dificultades: await repositorio.listarDificultades(),
    decisiones: await repositorio.listarDecisiones(),
  };
}

function aPreguntaARevisar(
  { copia, correctaId, ...fila }: FilaRevisionAbierta,
  opciones: Awaited<ReturnType<typeof opcionesDeLaPauta>>,
): PreguntaARevisar {
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
    ...opciones,
  };
}

/** Los puntos de la pauta: todos, una vez cada uno, con la observación de cada «no» (CU-19 paso 3). */
function problemasDeLaPauta(datos: DatosRevision, pauta: readonly Criterio[]): ProblemaDeCampo[] {
  const respondidos = new Map(datos.criterios.map((criterio) => [criterio.codigo, criterio]));
  const sobran = datos.criterios.length !== respondidos.size;
  const fuera = datos.criterios.some(
    (criterio) => !pauta.some((p) => p.codigo === criterio.codigo),
  );
  if (sobran || fuera || respondidos.size !== pauta.length) {
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

/** CU-19 pasos 4 y 5: la dificultad y la decisión existen, y el motivo cuando la decisión lo pide (5.a). */
function problemasDeLaDecision(
  datos: DatosRevision,
  { dificultades, decisiones }: Pick<PreguntaARevisar, 'dificultades' | 'decisiones'>,
): ProblemaDeCampo[] {
  const decision = decisiones.find((candidata) => candidata.codigo === datos.decision);
  return [
    !dificultades.some((d) => d.codigo === datos.dificultad) &&
      problema('dificultad', 'Elige la dificultad: fácil, media o difícil.'),
    !decision && problema('decision', 'Elige si apruebas, observas o rechazas la pregunta.'),
    decision?.requiereComentario &&
      !datos.comentario &&
      problema(
        'comentario',
        `Escribe el motivo para ${decision.nombre.toLowerCase()} la pregunta.`,
      ),
  ].filter((p): p is ProblemaDeCampo => typeof p === 'object' && p !== null);
}

async function entregarRevision(
  { unidadDeTrabajo, reloj, repositorio }: DependenciasBandeja,
  [docenteId, id]: [string, string],
  datos: DatosRevision,
): Promise<RevisionEntregada> {
  const opciones = await opcionesDeLaPauta(repositorio);
  const problemas = [
    ...problemasDeLaPauta(datos, opciones.pauta),
    ...problemasDeLaDecision(datos, opciones),
  ];
  if (problemas.length > 0) throw new ErrorValidacion(problemas, problemas[0]?.mensaje);
  return unidadDeTrabajo.enTransaccion(async (tx) => {
    const estado = await repositorio.reservarAsignacion(id, docenteId, tx);
    if (estado === null) throw new ErrorNoEncontrado(NO_EXISTE);
    if (estado !== 'pendiente') throw new ErrorConflicto('Esta revisión ya se entregó.');
    const pendiente = await repositorio.obtenerPendiente(id, docenteId, tx);
    if (!pendiente) throw new ErrorNoEncontrado(NO_EXISTE);
    await repositorio.guardarRevision(
      {
        asignacionId: id,
        decision: datos.decision,
        dificultad: datos.dificultad,
        comentario: datos.comentario,
        criterios: datos.criterios,
        entregadaEn: reloj(),
      },
      tx,
    );
    return {
      asignacionId: id,
      preguntaId: pendiente.preguntaId,
      decision: datos.decision,
      dificultad: datos.dificultad,
    };
  });
}

export function crearBandejaDocente(dependencias: DependenciasBandeja): BandejaDocente {
  const { repositorio } = dependencias;
  return {
    async listarMisRevisiones(docenteId) {
      const filas = await repositorio.listarPendientes(docenteId);
      return filas.map((fila) => ({ ...fila, venceEn: fila.venceEn.toISOString() }));
    },
    async obtenerMiRevision(docenteId, id) {
      const fila = await repositorio.obtenerPendiente(id, docenteId);
      if (!fila) throw new ErrorNoEncontrado(NO_EXISTE);
      return aPreguntaARevisar(fila, await opcionesDeLaPauta(repositorio));
    },
    entregarRevision: (docenteId, id, datos) =>
      entregarRevision(dependencias, [docenteId, id], datos),
  };
}
