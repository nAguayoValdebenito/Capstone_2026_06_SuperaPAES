// Lo que espera acción en la consola, a partir de los contadores del menú (un solo origen de datos): lo usan
// la campana de la barra superior y «Requiere atención» del Panel.
import { ASUNTO_DE_CONTADOR, type Contadores } from './contadores-menu';

/** Nombre de la sección de cada contador (igual al del menú; aquí para no importar las páginas). */
const SECCION_DE_CONTADOR: Readonly<Record<string, string>> = {
  '/avisos-error': 'Avisos de error',
  '/solicitudes-datos': 'Solicitudes de datos',
  '/revisiones': 'Revisiones',
  '/revision': 'Mis revisiones',
  '/desempates': 'Desempates',
};

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
      seccion: SECCION_DE_CONTADOR[ruta] ?? ruta,
    }));
}
