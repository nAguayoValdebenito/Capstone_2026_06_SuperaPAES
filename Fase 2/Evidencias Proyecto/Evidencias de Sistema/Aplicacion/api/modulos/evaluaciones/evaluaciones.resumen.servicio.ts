// HU-30.1: cierre y resumen de una práctica. No depende del cupo: HU-33/CU-07b solo limita iniciar,
// pedir una pregunta nueva y responder; terminar y revisar el resultado siempre sigue disponible.
import type { Ejecutor, UnidadDeTrabajo } from '../../db/transaccion.js';
import {
  evaluacionAbierta,
  evaluacionCerrada,
  evaluacionNoEncontrada,
} from './evaluaciones.errores.js';
import type { ResumenRepositorio } from './evaluaciones.resumen.repositorio.js';

export interface DependenciasResumen {
  repositorio: ResumenRepositorio;
  unidadDeTrabajo: UnidadDeTrabajo;
}

async function leerResumenCerrado(
  repositorio: ResumenRepositorio,
  estudianteId: string,
  id: string,
  tx: Ejecutor,
) {
  const resumen = await repositorio.leerResumen(id, estudianteId, tx);
  if (!resumen) throw new Error('La práctica cerrada no tiene un resultado guardado.');
  return resumen;
}

async function cerrar(dependencias: DependenciasResumen, estudianteId: string, id: string) {
  const { repositorio, unidadDeTrabajo } = dependencias;
  return unidadDeTrabajo.enTransaccion(async (tx) => {
    const practica = await repositorio.bloquearPractica(id, estudianteId, tx);
    if (!practica) throw evaluacionNoEncontrada();
    if (practica.cerradaEn) throw evaluacionCerrada();
    await repositorio.cerrarEntregada(id, tx);
    return leerResumenCerrado(repositorio, estudianteId, id, tx);
  });
}

async function resumen(dependencias: DependenciasResumen, estudianteId: string, id: string) {
  const { repositorio, unidadDeTrabajo } = dependencias;
  return unidadDeTrabajo.enTransaccion(async (tx) => {
    const practica = await repositorio.bloquearPractica(id, estudianteId, tx);
    if (!practica) throw evaluacionNoEncontrada();
    if (!practica.cerradaEn) throw evaluacionAbierta();
    return leerResumenCerrado(repositorio, estudianteId, id, tx);
  });
}

export function crearResumenServicio(dependencias: DependenciasResumen) {
  return {
    cerrarPractica: (estudianteId: string, id: string) => cerrar(dependencias, estudianteId, id),
    resumenPractica: (estudianteId: string, id: string) => resumen(dependencias, estudianteId, id),
  };
}

export type ResumenServicio = ReturnType<typeof crearResumenServicio>;
