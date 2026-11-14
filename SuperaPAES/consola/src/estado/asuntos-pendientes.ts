// Lo que espera acción en la consola, a partir de los contadores del menú (un solo origen de datos): lo usan
// la campana de la barra superior y «Requiere atención» del Panel.
import { seccionDeRuta } from '../rutas/secciones';
import { ASUNTO_DE_CONTADOR, type Contadores } from './contadores-menu';

export interface Asunto {
  ruta: string;
  /** Pide acción (granate) en lugar de ser un dato pendiente (pizarra). */
  alerta: boolean;
  texto: string;
  seccion: string;
}

/** Los asuntos con algo pendiente: primero los que piden acción. */
export function asuntosPendientes(contadores: Contadores): Asunto[] {
  return Object.entries(contadores)
    .filter(([ruta, c]) => c.valor > 0 && ASUNTO_DE_CONTADOR[ruta])
    .sort(([, a], [, b]) => Number(b.alerta) - Number(a.alerta))
    .map(([ruta, c]) => ({
      ruta,
      alerta: c.alerta,
      texto: `${String(c.valor)} ${ASUNTO_DE_CONTADOR[ruta] ?? ''}`,
      seccion: seccionDeRuta(ruta)?.titulo ?? ruta,
    }));
}
