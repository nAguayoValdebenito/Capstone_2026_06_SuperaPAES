// Reglas de negocio del módulo generador: lotes de generación de preguntas con IA (la cola la consume el
// worker de trabajos/).
// Es la única puerta de entrada al módulo: los demás módulos usan este servicio, nunca su repositorio.
// Productor-consumidor: la consola crea lotes pendientes en contenido.lote_generacion (productor) y el
// worker llama a procesarPendientes (consumidor), que usa el proveedor de IA y guarda las propuestas
// válidas a través del servicio de preguntas.
import type { ProveedorIA } from '../../adaptadores/fabrica.js';
import type { Reloj } from '../../comun/reloj.js';
import type { CandadosDeSesion } from '../../db/candados.js';
import type { Ejecutor, UnidadDeTrabajo } from '../../db/transaccion.js';
import type { AdministracionServicio } from '../administracion/index.js';
import type { PreguntasServicio } from '../preguntas/index.js';
import type { TemarioServicio } from '../temario/index.js';
import { crearConsultas, type Consultas } from './generador.consultas.servicio.js';
import { crearLotesRepositorio, type LotesRepositorio } from './generador.lotes.repositorio.js';
import { crearProcesador, type OpcionesProcesador } from './generador.procesador.servicio.js';
import { crearProductor, type Productor } from './generador.productor.servicio.js';

export interface DependenciasGeneradorServicio {
  bd: Ejecutor;
  unidadDeTrabajo: UnidadDeTrabajo;
  reloj: Reloj;
  ia: ProveedorIA;
  administracion: AdministracionServicio;
  preguntas: PreguntasServicio;
  temario: TemarioServicio;
  /** Candados de sesión: un solo proceso trabaja cada lote. */
  candados: CandadosDeSesion;
  /** Solo para pruebas: azar, plazo y resultado objetivo del worker. */
  opciones?: OpcionesProcesador;
  /** Solo para pruebas: reemplaza al repositorio que se crea con crearLotesRepositorio(bd). */
  repositorio?: LotesRepositorio;
}

export interface GeneradorServicio extends Productor, Consultas {
  /** Procesa los lotes pendientes y devuelve cuántos procesó. */
  procesarPendientes(): Promise<number>;
}

export function crearGeneradorServicio(
  dependencias: DependenciasGeneradorServicio,
): GeneradorServicio {
  const lotes = dependencias.repositorio ?? crearLotesRepositorio(dependencias.bd);
  const productor = crearProductor({
    unidadDeTrabajo: dependencias.unidadDeTrabajo,
    reloj: dependencias.reloj,
    lotes,
    temario: dependencias.temario,
    administracion: dependencias.administracion,
    ia: dependencias.ia,
  });
  const procesador = crearProcesador({
    unidadDeTrabajo: dependencias.unidadDeTrabajo,
    reloj: dependencias.reloj,
    lotes,
    candados: dependencias.candados,
    temario: dependencias.temario,
    preguntas: dependencias.preguntas,
    administracion: dependencias.administracion,
    ia: dependencias.ia,
    ...(dependencias.opciones && { opciones: dependencias.opciones }),
  });
  const consultas = crearConsultas({
    reloj: dependencias.reloj,
    lotes,
    administracion: dependencias.administracion,
  });
  return { ...productor, ...procesador, ...consultas };
}
