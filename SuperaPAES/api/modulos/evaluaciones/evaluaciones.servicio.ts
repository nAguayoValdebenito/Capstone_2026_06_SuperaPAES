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
import { crearPracticasRepositorio } from './evaluaciones.practicas.repositorio.js';
import {
  crearPracticasServicio,
  type PracticasServicio,
} from './evaluaciones.practicas.servicio.js';
import { conReintentoDeInicio } from './evaluaciones.reintento-inicio.js';

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

export type EvaluacionesServicio = SeleccionPractica & PracticasServicio;

function crearServicioSinReintento(
  dependencias: DependenciasEvaluacionesServicio,
): EvaluacionesServicio {
  const seleccion = crearSeleccionPractica({
    repositorio: dependencias.repositorio ?? crearEvaluacionesRepositorio(dependencias.bd),
    administracion: dependencias.administracion,
    reloj: dependencias.reloj,
    azar: dependencias.azar ?? Math.random,
  });
  return {
    ...seleccion,
    ...crearPracticasServicio({
      repositorio: crearPracticasRepositorio(),
      unidadDeTrabajo: dependencias.unidadDeTrabajo,
      cuentas: dependencias.cuentas,
      temario: dependencias.temario,
      seleccion,
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
  };
}
