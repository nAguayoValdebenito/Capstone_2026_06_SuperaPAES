// Reglas de negocio del módulo generador: lotes de generación de preguntas con IA (la cola la
// consume el worker de trabajos/).
// Es la única puerta de entrada al módulo: los demás módulos usan este servicio, nunca su repositorio.
// Productor-consumidor: la consola crea lotes pendientes en contenido.lote_generacion (productor) y el
// worker llama a procesarPendientes (consumidor), que usa el proveedor de IA y guarda las propuestas
// válidas a través del servicio de preguntas.
import type { ProveedorIA } from '../../adaptadores/fabrica.js';
import type { Ejecutor, UnidadDeTrabajo } from '../../db/transaccion.js';
import type { AdministracionServicio } from '../administracion/index.js';
import type { PreguntasServicio } from '../preguntas/index.js';
import type { GeneradorRepositorio } from './generador.repositorio.js';

export interface DependenciasGeneradorServicio {
  bd: Ejecutor;
  unidadDeTrabajo: UnidadDeTrabajo;
  ia: ProveedorIA;
  administracion: AdministracionServicio;
  preguntas: PreguntasServicio;
  /** Solo para pruebas: reemplaza al repositorio que se crea con crearGeneradorRepositorio(bd). */
  repositorio?: GeneradorRepositorio;
}

export interface GeneradorServicio {
  /** Procesa los lotes pendientes y devuelve cuántos procesó. */
  procesarPendientes(): Promise<number>;
}

export function crearGeneradorServicio(
  _dependencias: DependenciasGeneradorServicio,
): GeneradorServicio {
  return {
    // Esqueleto: todavía no hay lotes que leer; se implementa en la historia del generador.
    procesarPendientes: () => Promise.resolve(0),
  };
}
