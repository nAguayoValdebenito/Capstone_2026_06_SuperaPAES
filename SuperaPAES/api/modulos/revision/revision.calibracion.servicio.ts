// Bandeja de calibración del docente (D04, HU-26.1, RF-G13, RN-15; plan hu-26-calibracion.md, D4 y D5).
// Aparecen las preguntas publicadas con 30 o más intentos cuyo acierto no cae en el rango de su dificultad,
// del área del docente. El docente confirma que la dificultad no corresponde (pasa al administrador; basta
// uno) o la descarta (sale solo de su bandeja). La decisión vale para la versión y la dificultad que la
// pregunta tiene ahora, y queda en la auditoría en la misma transacción.
import { ErrorConflicto, ErrorNoEncontrado } from '../../comun/errores.js';
import type { Reloj } from '../../comun/reloj.js';
import type { Ejecutor, UnidadDeTrabajo } from '../../db/transaccion.js';
import type { AdministracionServicio } from '../administracion/index.js';
import type { EvaluacionesServicio } from '../evaluaciones/index.js';
import type {
  CalibracionRepositorio,
  PreguntaDeCalibracion,
} from './revision.calibracion.repositorio.js';
import { INTENTOS_MINIMOS_CALIBRACION } from './revision.reglas.js';

type FueraDeRango = Awaited<ReturnType<EvaluacionesServicio['estadisticasFueraDeRango']>>[number];

/** Una fila de la bandeja: la pregunta, su dificultad con el rango esperado y sus estadísticas. */
export type ItemCalibracion = PreguntaDeCalibracion &
  Pick<FueraDeRango, 'intentos' | 'aciertos' | 'porcentajeAcierto' | 'tiempoPromedioSeg'> & {
    dificultad: Omit<FueraDeRango['dificultad'], 'id'>;
  };

/** La decisión guardada. */
export interface DecisionGuardada {
  preguntaId: string;
  dificultadCorresponde: boolean;
  creadoEn: string;
}

export interface CalibracionDocente {
  listarCalibracion(docenteId: string): Promise<ItemCalibracion[]>;
  decidirCalibracion(
    docenteId: string,
    preguntaId: string,
    datos: { dificultadCorresponde: boolean },
  ): Promise<DecisionGuardada>;
}

export interface DependenciasCalibracion {
  unidadDeTrabajo: UnidadDeTrabajo;
  reloj: Reloj;
  repositorio: CalibracionRepositorio;
  evaluaciones: Pick<EvaluacionesServicio, 'estadisticasFueraDeRango'>;
  administracion: Pick<AdministracionServicio, 'registrarAuditoria'>;
}

const candidata = (e: FueraDeRango) => ({
  preguntaId: e.preguntaId,
  version: e.version,
  dificultadId: e.dificultad.id,
});

function unir(estadistica: FueraDeRango, pregunta: PreguntaDeCalibracion): ItemCalibracion {
  const { codigo, nombre, aciertoEsperadoMin, aciertoEsperadoMax } = estadistica.dificultad;
  return {
    ...pregunta,
    dificultad: { codigo, nombre, aciertoEsperadoMin, aciertoEsperadoMax },
    intentos: estadistica.intentos,
    aciertos: estadistica.aciertos,
    porcentajeAcierto: estadistica.porcentajeAcierto,
    tiempoPromedioSeg: estadistica.tiempoPromedioSeg,
  };
}

const NO_EN_BANDEJA = 'La pregunta no está en tu bandeja de calibración.';
const YA_DECIDIO = 'Ya decidiste sobre esta pregunta.';

export function crearCalibracionDocente(dependencias: DependenciasCalibracion): CalibracionDocente {
  const { repositorio, evaluaciones } = dependencias;
  const fueraDeRango = () => evaluaciones.estadisticasFueraDeRango(INTENTOS_MINIMOS_CALIBRACION);

  return {
    async listarCalibracion(docenteId) {
      const estadisticas = await fueraDeRango();
      const pendientes = await repositorio.pendientesDelDocente(
        docenteId,
        estadisticas.map(candidata),
      );
      const porId = new Map(estadisticas.map((e) => [e.preguntaId, e]));
      return pendientes.flatMap((p) => {
        const estadistica = porId.get(p.preguntaId);
        return estadistica ? [unir(estadistica, p)] : [];
      });
    },

    async decidirCalibracion(docenteId, preguntaId, { dificultadCorresponde }) {
      const estadistica = (await fueraDeRango()).find((e) => e.preguntaId === preguntaId);
      if (!estadistica) throw new ErrorNoEncontrado(NO_EN_BANDEJA);
      return dependencias.unidadDeTrabajo.enTransaccion(async (tx) => {
        const pendiente = await repositorio.pendientesDelDocente(
          docenteId,
          [candidata(estadistica)],
          tx,
        );
        if (pendiente.length === 0) await rechazar(repositorio, [docenteId, estadistica], tx);
        const creadoEn = dependencias.reloj();
        const decision = { docenteId, dificultadCorresponde, creadoEn };
        await guardar(dependencias, [estadistica, decision], tx);
        return { preguntaId, dificultadCorresponde, creadoEn: creadoEn.toISOString() };
      });
    },
  };
}

/** Guarda la decisión y la deja en la auditoría; si otra petición igual llegó antes, 409. */
async function guardar(
  { repositorio, administracion }: DependenciasCalibracion,
  [estadistica, decision]: [
    FueraDeRango,
    { docenteId: string; dificultadCorresponde: boolean; creadoEn: Date },
  ],
  tx: Ejecutor,
): Promise<void> {
  const { intentos, aciertos, version } = estadistica;
  const guardada = await repositorio.guardarDecision(
    { ...candidata(estadistica), ...decision, intentos, aciertos },
    tx,
  );
  if (!guardada) throw new ErrorConflicto(YA_DECIDIO);
  await administracion.registrarAuditoria(
    {
      usuarioId: decision.docenteId,
      accion: decision.dificultadCorresponde ? 'descartar_calibracion' : 'confirmar_calibracion',
      entidad: 'pregunta',
      entidadId: estadistica.preguntaId,
      antes: null,
      despues: {
        version,
        dificultad: estadistica.dificultad.codigo,
        intentos,
        aciertos,
        dificultadCorresponde: decision.dificultadCorresponde,
      },
    },
    tx,
  );
}

/**
 * No se guardó: si el docente ya decidió esta versión y dificultad, 409; si la pregunta no es de su área,
 * 404 (no se revela que existe).
 */
async function rechazar(
  repositorio: CalibracionRepositorio,
  [docenteId, estadistica]: [string, FueraDeRango],
  tx: Ejecutor,
): Promise<never> {
  if (await repositorio.yaDecidio(docenteId, candidata(estadistica), tx)) {
    throw new ErrorConflicto(YA_DECIDIO);
  }
  throw new ErrorNoEncontrado(NO_EN_BANDEJA);
}
