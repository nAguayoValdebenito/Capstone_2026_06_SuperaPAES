// Tipos del consumidor de la cola de generación (el worker del generador con IA).
import type {
  ProveedorIA,
  ResultadoGeneracion,
  SolicitudGeneracion,
} from '../../adaptadores/ia/proveedor.js';
import type { Reloj } from '../../comun/reloj.js';
import type { CandadosDeSesion } from '../../db/candados.js';
import type { UnidadDeTrabajo } from '../../db/transaccion.js';
import type { AdministracionServicio } from '../administracion/index.js';
import type { EjemploDePregunta, PreguntasServicio } from '../preguntas/index.js';
import type { ContenidoParaGenerar, TemarioServicio } from '../temario/index.js';
import type { Precios } from './generador.costo.js';
import type { FilaLote, LotesRepositorio } from './generador.lotes.repositorio.js';

export interface OpcionesProcesador {
  /** Azar en [0, 1) para las fichas y el orden de las alternativas; se inyecta en las pruebas. */
  aleatorio?: () => number;
  plazoMaximoMs?: number;
  /** El resultado objetivo de las pruebas numéricas es una sugerencia; la medición compara con y sin él. */
  usarResultadoObjetivo?: boolean;
}

export interface DependenciasProcesador {
  unidadDeTrabajo: UnidadDeTrabajo;
  reloj: Reloj;
  lotes: LotesRepositorio;
  candados: CandadosDeSesion;
  temario: Pick<TemarioServicio, 'contenidoParaGenerar' | 'mezclaDeDificultad'>;
  preguntas: Pick<
    PreguntasServicio,
    'enunciadosDelContenido' | 'ejemplosAprobados' | 'guardarPropuestaDeIa'
  >;
  administracion: Pick<AdministracionServicio, 'obtenerParametroEntero' | 'obtenerParametroNumero'>;
  ia: Pick<ProveedorIA, 'nombre' | 'usa' | 'generarPreguntas'>;
  opciones?: OpcionesProcesador;
}

/** Todo lo que un turno necesita saber de su lote; se arma una vez al empezar. */
export interface Turno {
  lote: FilaLote;
  contenido: ContenidoParaGenerar;
  precios: Precios;
  temperaturas: NonNullable<SolicitudGeneracion['temperaturas']>;
  maximoMensual: number;
  concurrencia: number;
  limiteMs: number;
  /** Enunciados del contenido y de las propuestas ya guardadas en este turno. */
  existentes: string[];
  ejemplos: EjemploDePregunta[];
  mezcla: Awaited<ReturnType<TemarioServicio['mezclaDeDificultad']>>;
  fallasSeguidas: number;
}

/** Lo que pasó al pedir una pregunta a la IA. */
export type Intento =
  | { tipo: 'respuesta'; resultado: ResultadoGeneracion }
  | { tipo: 'falla'; codigo: string; saldoAgotado: boolean };

export type FallaDeLaIa = Extract<Intento, { tipo: 'falla' }>;
