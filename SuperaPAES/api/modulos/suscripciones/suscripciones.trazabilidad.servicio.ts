// Trazabilidad de suscripciones en la consola (HU-56, CU-27, RF-C09, RN-17, RN-26): el resumen por
// plan, estado y mes, la lista con filtros, la línea de tiempo de cada suscripción con sus pagos y los
// avisos de la tienda, y la bandeja de avisos con error. Solo consulta: el historial y los avisos los
// escriben la compra (HU-43) y la recepción de avisos (HU-44), y nunca se modifican.
import type { Paginacion } from '../../comun/respuesta.js';
import { ErrorNoEncontrado } from '../../comun/errores.js';
import type {
  AvisoConError,
  DetalleSuscripcion,
  FilaSuscripcion,
  ResumenSuscripciones,
  Tramo,
  TrazabilidadRepositorio,
} from './suscripciones.trazabilidad.repositorio.js';
import type {
  ConsultaAvisos,
  FiltrosSuscripciones,
} from './suscripciones.trazabilidad.validadores.js';

export interface TrazabilidadServicio {
  /** HU-56 esc. 1: tarjetas del mes, suscripciones por plan y estado, pagos por mes y los filtros. */
  resumenSuscripciones(): Promise<ResumenSuscripciones>;
  /** HU-56 esc. 2: una página de suscripciones, de la más nueva a la más antigua. */
  listarSuscripciones(
    filtros: FiltrosSuscripciones,
  ): Promise<{ suscripciones: FilaSuscripcion[]; paginacion: Paginacion }>;
  /** HU-56 esc. 3: la suscripción con su historial, sus pagos y los avisos de la tienda. */
  detalleSuscripcion(id: string): Promise<DetalleSuscripcion>;
  /** HU-56 esc. 4: los avisos de las tiendas que no se pudieron procesar, con su motivo. */
  avisosConError(
    consulta: ConsultaAvisos,
  ): Promise<{ avisos: AvisoConError[]; paginacion: Paginacion }>;
}

/** El límite y el desplazamiento de la página pedida. */
const tramo = ({ pagina, porPagina }: ConsultaAvisos): Tramo => [
  porPagina,
  (pagina - 1) * porPagina,
];

export function crearTrazabilidadServicio(
  repositorio: TrazabilidadRepositorio,
): TrazabilidadServicio {
  return {
    resumenSuscripciones: () => repositorio.resumen(),

    async listarSuscripciones(filtros) {
      const { pagina, porPagina } = filtros;
      const { filas, total } = await repositorio.listar(filtros, tramo(filtros));
      return { suscripciones: filas, paginacion: { pagina, porPagina, total } };
    },

    async detalleSuscripcion(id) {
      const detalle = await repositorio.detalle(id);
      if (!detalle) throw new ErrorNoEncontrado('La suscripción no existe.');
      return detalle;
    },

    async avisosConError(consulta) {
      const { pagina, porPagina } = consulta;
      const { filas, total } = await repositorio.avisosConError(tramo(consulta));
      return { avisos: filas, paginacion: { pagina, porPagina, total } };
    },
  };
}
