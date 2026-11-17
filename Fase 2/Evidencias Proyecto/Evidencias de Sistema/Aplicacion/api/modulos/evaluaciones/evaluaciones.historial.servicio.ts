// HU-62.1 (RF-A24, CU-30, A34): el historial por páginas y con filtros, del estudiante de la sesión. Cada fila se
// abre con el resultado y la revisión de HU-61.1.
import type { Paginacion } from '../../comun/respuesta.js';
import type {
  FilaHistorial,
  FiltroHistorial,
  HistorialRepositorio,
} from './evaluaciones.historial.repositorio.js';

export function crearHistorialServicio(repositorio: HistorialRepositorio) {
  return {
    listarHistorial: async (
      filtro: FiltroHistorial,
    ): Promise<{ evaluaciones: FilaHistorial[]; paginacion: Paginacion }> => {
      const { filas, total } = await repositorio.listar(filtro);
      const { pagina, porPagina } = filtro;
      return { evaluaciones: filas, paginacion: { pagina, porPagina, total } };
    },
  };
}

export type HistorialServicio = ReturnType<typeof crearHistorialServicio>;
