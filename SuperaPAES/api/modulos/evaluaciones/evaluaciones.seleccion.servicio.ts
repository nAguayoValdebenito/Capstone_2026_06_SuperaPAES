import type { Reloj } from '../../comun/reloj.js';
import type { Ejecutor } from '../../db/transaccion.js';
import type { AdministracionServicio } from '../administracion/index.js';
import type { EvaluacionesRepositorio } from './evaluaciones.repositorio.js';
import { calcularCuotas } from './evaluaciones.cuotas.js';
import { seleccionarCandidata } from './evaluaciones.seleccion.js';
import type {
  DatosSeleccion,
  FiltrosSeleccion,
  PreguntaSeleccionada,
  ParametrosSeleccion,
} from './evaluaciones.seleccion.tipos.js';

export interface SeleccionPractica {
  contarDisponibles(datos: FiltrosSeleccion, tx?: Ejecutor): Promise<number>;
  elegirSiguiente(datos: DatosSeleccion, tx?: Ejecutor): Promise<PreguntaSeleccionada | null>;
}
export interface DependenciasSeleccion {
  repositorio: EvaluacionesRepositorio;
  reloj: Reloj;
  azar: () => number;
  administracion: Pick<AdministracionServicio, 'obtenerParametroEntero'>;
}

function validarFiltros(datos: FiltrosSeleccion): void {
  if (
    [datos.ejeId, datos.contenidoId, datos.habilidadId].filter((v) => v !== undefined).length > 1
  ) {
    throw new Error('Elige a lo más un alcance: eje, contenido o habilidad.');
  }
  if (!Number.isFinite(datos.iniciadaEn.getTime()))
    throw new Error('Falta una fecha de inicio válida.');
  if (new Set(datos.entregadas.map((p) => p.preguntaId)).size !== datos.entregadas.length) {
    throw new Error('La lista de entregadas no puede repetir preguntas.');
  }
}

async function parametros({
  administracion,
  reloj,
}: DependenciasSeleccion): Promise<ParametrosSeleccion> {
  const diasSinRepetir = await administracion.obtenerParametroEntero('dias_sin_repetir');
  const minRespuestas = await administracion.obtenerParametroEntero('min_respuestas_eje');
  const umbralDebil = await administracion.obtenerParametroEntero('umbral_eje_debil');
  return { ahora: reloj(), diasSinRepetir, minRespuestas, umbralDebil };
}

async function elegir(
  dependencias: DependenciasSeleccion,
  datos: DatosSeleccion,
  tx?: Ejecutor,
): Promise<PreguntaSeleccionada | null> {
  validarFiltros(datos);
  if (!Number.isSafeInteger(datos.cantidad) || datos.cantidad <= 0)
    throw new Error('La cantidad debe ser un entero positivo.');
  if (datos.entregadas.length >= datos.cantidad) return null;
  const { repositorio, azar } = dependencias;
  const p = await parametros(dependencias);
  const cuotas = datos.cuotas ?? calcularCuotas(datos.cantidad, await repositorio.leerMezcla(tx));
  if (
    Object.values(cuotas).some((n) => !Number.isSafeInteger(n) || n < 0) ||
    cuotas.facil + cuotas.media + cuotas.dificil !== datos.cantidad
  )
    throw new Error('Las cuotas deben sumar la cantidad original.');
  const candidatas = await repositorio.buscarCandidatas(datos, p, tx);
  const entregadas = await repositorio.leerEntregadas(datos, p, tx);
  if (entregadas.length !== datos.entregadas.length)
    throw new Error('Una pregunta entregada no tiene esa versión publicada en esta prueba.');
  const elegida = seleccionarCandidata({ candidatas, entregadas, datos, cuotas }, azar);
  return elegida ? { preguntaId: elegida.preguntaId, version: elegida.version } : null;
}

export function crearSeleccionPractica(dependencias: DependenciasSeleccion): SeleccionPractica {
  return {
    async contarDisponibles(datos, tx) {
      validarFiltros(datos);
      return dependencias.repositorio.contarDisponibles(datos, await parametros(dependencias), tx);
    },
    elegirSiguiente: (datos, tx) => elegir(dependencias, datos, tx),
  };
}
