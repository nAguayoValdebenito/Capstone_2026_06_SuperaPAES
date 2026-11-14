// Reglas de negocio del módulo evaluaciones: evaluaciones (práctica, repaso, diagnóstico, mini-ensayo y
// ensayo completo), respuestas corregidas por la base, resultados, estadísticas y progreso.
// Incluye la estructura de cada evaluación (reparto por eje) y las tablas de conversión del DEMRE.
// Es la única puerta de entrada al módulo: los demás módulos usan este servicio, nunca su repositorio.
import type { Ejecutor, UnidadDeTrabajo } from '../../db/transaccion.js';
import type { Reloj } from '../../comun/reloj.js';
import type { AdministracionServicio } from '../administracion/index.js';
import type { CuentasServicio } from '../cuentas/index.js';
import type { CupoInvitacionesServicio } from '../cupo-invitaciones/index.js';
import type { PreguntasServicio } from '../preguntas/index.js';
import type { SuscripcionesServicio } from '../suscripciones/index.js';
import type { TemarioServicio } from '../temario/index.js';
import {
  crearEvaluacionesRepositorio,
  type EvaluacionesRepositorio,
} from './evaluaciones.repositorio.js';
import {
  crearSeleccionPractica,
  type SeleccionPractica,
} from './evaluaciones.seleccion.servicio.js';
import { crearConfiguracionRepositorio } from './evaluaciones.configuracion.repositorio.js';
import {
  crearConfiguracionEvaluaciones,
  type ConfiguracionEvaluaciones,
} from './evaluaciones.configuracion.servicio.js';
import { crearPracticasRepositorio } from './evaluaciones.practicas.repositorio.js';
import {
  crearPracticasServicio,
  type PracticasServicio,
} from './evaluaciones.practicas.servicio.js';
import { crearHistorialRepositorio } from './evaluaciones.historial.repositorio.js';
import {
  crearHistorialServicio,
  type HistorialServicio,
} from './evaluaciones.historial.servicio.js';
import { crearRepasoRepositorio } from './evaluaciones.repaso.repositorio.js';
import {
  crearEleccionFallada,
  crearRepasoServicio,
  type DependenciasRepaso,
  type RepasoServicio,
} from './evaluaciones.repaso.servicio.js';
import { crearRespuestasRepositorio } from './evaluaciones.respuestas.repositorio.js';
import {
  crearRespuestasServicio,
  type RespuestasServicio,
} from './evaluaciones.respuestas.servicio.js';
import { crearProgresoRepositorio } from './evaluaciones.progreso.repositorio.js';
import { crearProgresoServicio, type ProgresoServicio } from './evaluaciones.progreso.servicio.js';
import {
  crearExportacionEvaluaciones,
  type ExportacionEvaluaciones,
} from './evaluaciones.exportacion.servicio.js';
import { crearResumenRepositorio } from './evaluaciones.resumen.repositorio.js';
import { crearResumenServicio, type ResumenServicio } from './evaluaciones.resumen.servicio.js';
import { crearResultadoRepositorio } from './evaluaciones.resultado.repositorio.js';
import {
  crearResultadoServicio,
  type ResultadoServicio,
} from './evaluaciones.resultado.servicio.js';
import { crearAbiertaRepositorio } from './evaluaciones.abierta.repositorio.js';
import {
  crearImpactoRepositorio,
  type ImpactoDeAnular,
} from './evaluaciones.impacto.repositorio.js';
import { crearAbiertaServicio, type AbiertaServicio } from './evaluaciones.abierta.servicio.js';
import {
  crearEstadisticasRepositorio,
  type EstadisticaFueraDeRango,
  type EstadisticaPregunta,
} from './evaluaciones.estadisticas.repositorio.js';
import { conReintentoDeInicio } from './evaluaciones.reintento-inicio.js';
import { crearMiniServicio, type MiniServicio } from './evaluaciones.mini.servicio.js';
import { crearEnsayoServicio, type EnsayoServicio } from './evaluaciones.ensayo.servicio.js';
import { crearEntregaServicio, type EntregaServicio } from './evaluaciones.entrega.servicio.js';

export interface DependenciasEvaluacionesServicio {
  bd: Ejecutor;
  unidadDeTrabajo: UnidadDeTrabajo;
  cupoInvitaciones: CupoInvitacionesServicio;
  preguntas: PreguntasServicio;
  suscripciones: SuscripcionesServicio;
  administracion: AdministracionServicio;
  cuentas: CuentasServicio;
  temario: TemarioServicio;
  reloj: Reloj;
  azar?: () => number;
  /** Solo para pruebas: reemplaza al repositorio que se crea con crearEvaluacionesRepositorio(bd). */
  repositorio?: EvaluacionesRepositorio;
}

export type EvaluacionesServicio = ConfiguracionEvaluaciones &
  MiniServicio &
  EnsayoServicio &
  EntregaServicio &
  SeleccionPractica &
  PracticasServicio &
  RepasoServicio &
  RespuestasServicio &
  ResumenServicio &
  ResultadoServicio &
  HistorialServicio &
  ProgresoServicio &
  ExportacionEvaluaciones &
  AbiertaServicio & {
    /** HU-50.2 (C13): evaluaciones donde aparece una pregunta, antes de anularla. */
    impactoDeAnular(preguntaId: string): Promise<ImpactoDeAnular>;
    /** HU-53.1 (tarea periódica): recalcula las estadísticas por pregunta; cuántas cambiaron. */
    recalcularEstadisticas(): Promise<number>;
    /** HU-53.1: estadísticas de esas preguntas, para el banco y la bandeja de calibración. */
    estadisticasDe(preguntaIds: string[]): Promise<EstadisticaPregunta[]>;
    /** HU-26.1 (RN-15): publicadas con esos intentos o más y el acierto fuera de su rango. */
    estadisticasFueraDeRango(minIntentos: number): Promise<EstadisticaFueraDeRango[]>;
  };

function crearMini(dependencias: DependenciasEvaluacionesServicio) {
  return crearMiniServicio({
    unidadDeTrabajo: dependencias.unidadDeTrabajo,
    cuentas: dependencias.cuentas,
    cupo: dependencias.cupoInvitaciones,
    seleccion: dependencias.repositorio ?? crearEvaluacionesRepositorio(dependencias.bd),
  });
}

function crearEnsayo(dependencias: DependenciasEvaluacionesServicio) {
  return crearEnsayoServicio({
    unidadDeTrabajo: dependencias.unidadDeTrabajo,
    cuentas: dependencias.cuentas,
    suscripciones: dependencias.suscripciones,
    seleccion: dependencias.repositorio ?? crearEvaluacionesRepositorio(dependencias.bd),
    azar: dependencias.azar ?? Math.random,
  });
}

function crearProgreso(dependencias: DependenciasEvaluacionesServicio) {
  return crearProgresoServicio({
    repositorio: crearProgresoRepositorio(dependencias.bd),
    administracion: dependencias.administracion,
  });
}

/** HU-39.1: el repaso y la elección de sus preguntas, que usa la entrega de la práctica. */
function dependenciasRepaso(dependencias: DependenciasEvaluacionesServicio): DependenciasRepaso {
  return {
    repositorio: crearRepasoRepositorio(),
    practicas: crearPracticasRepositorio(),
    unidadDeTrabajo: dependencias.unidadDeTrabajo,
    cuentas: dependencias.cuentas,
    administracion: dependencias.administracion,
    suscripciones: dependencias.suscripciones,
  };
}

function crearPracticas(
  dependencias: DependenciasEvaluacionesServicio,
  seleccion: SeleccionPractica,
  repaso: DependenciasRepaso,
) {
  return crearPracticasServicio({
    repositorio: crearPracticasRepositorio(),
    unidadDeTrabajo: dependencias.unidadDeTrabajo,
    cuentas: dependencias.cuentas,
    temario: dependencias.temario,
    cupo: dependencias.cupoInvitaciones,
    reloj: dependencias.reloj,
    seleccion,
    elegirFallada: crearEleccionFallada(repaso),
  });
}

/** Lo que otros módulos consultan de una pregunta: su impacto al anularla y sus estadísticas. */
function crearConsultasPorPregunta(bd: Ejecutor) {
  const estadisticas = crearEstadisticasRepositorio(bd);
  return {
    impactoDeAnular: (preguntaId: string) => crearImpactoRepositorio(bd).contar(preguntaId),
    recalcularEstadisticas: () => estadisticas.recalcular(),
    estadisticasDe: (preguntaIds: string[]) => estadisticas.leer(preguntaIds),
    estadisticasFueraDeRango: (minIntentos: number) => estadisticas.fueraDeRango(minIntentos),
  };
}

function crearServicioSinReintento(
  dependencias: DependenciasEvaluacionesServicio,
): EvaluacionesServicio {
  const seleccion = crearSeleccionPractica({
    repositorio: dependencias.repositorio ?? crearEvaluacionesRepositorio(dependencias.bd),
    administracion: dependencias.administracion,
    reloj: dependencias.reloj,
    azar: dependencias.azar ?? Math.random,
  });
  const progreso = crearProgreso(dependencias);
  const repaso = dependenciasRepaso(dependencias);
  return {
    ...crearConfiguracionEvaluaciones({
      unidadDeTrabajo: dependencias.unidadDeTrabajo,
      repositorio: crearConfiguracionRepositorio(dependencias.bd),
      administracion: dependencias.administracion,
    }),
    ...seleccion,
    ...crearMini(dependencias),
    ...crearEnsayo(dependencias),
    ...crearEntregaServicio(dependencias.unidadDeTrabajo, dependencias.cuentas),
    ...crearPracticas(dependencias, seleccion, repaso),
    ...crearRepasoServicio(repaso),
    ...crearRespuestasServicio({
      repositorio: crearRespuestasRepositorio(),
      unidadDeTrabajo: dependencias.unidadDeTrabajo,
      cuentas: dependencias.cuentas,
      cupo: dependencias.cupoInvitaciones,
      reloj: dependencias.reloj,
    }),
    ...crearResumenServicio({
      repositorio: crearResumenRepositorio(),
      unidadDeTrabajo: dependencias.unidadDeTrabajo,
    }),
    ...crearResultadoServicio({
      repositorio: crearResultadoRepositorio(),
      unidadDeTrabajo: dependencias.unidadDeTrabajo,
      progreso,
    }),
    ...crearHistorialServicio(crearHistorialRepositorio(dependencias.bd)),
    ...crearConsultasPorPregunta(dependencias.bd),
    ...crearExportacionEvaluaciones(dependencias.bd),
    ...progreso,
    ...crearAbiertaServicio({
      repositorio: crearAbiertaRepositorio(dependencias.bd),
      unidadDeTrabajo: dependencias.unidadDeTrabajo,
      administracion: dependencias.administracion,
    }),
  };
}

export function crearEvaluacionesServicio(
  dependencias: DependenciasEvaluacionesServicio,
): EvaluacionesServicio {
  const servicio = crearServicioSinReintento(dependencias);
  return {
    ...servicio,
    // Dos inicios del mismo estudiante a la vez pueden chocar con la hora del cierre de la práctica
    // anterior: se repite la transacción completa (ver evaluaciones.reintento-inicio.ts).
    iniciarPractica: (estudianteId, datos) =>
      conReintentoDeInicio(() => servicio.iniciarPractica(estudianteId, datos)),
    iniciarRepaso: (estudianteId, datos) =>
      conReintentoDeInicio(() => servicio.iniciarRepaso(estudianteId, datos)),
  };
}
