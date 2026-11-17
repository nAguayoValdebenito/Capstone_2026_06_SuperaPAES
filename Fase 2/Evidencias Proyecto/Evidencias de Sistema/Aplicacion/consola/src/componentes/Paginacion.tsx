// Paginación de un listado de la API (meta { pagina, porPagina, total }): anterior, siguiente y en qué
// página se está. Solo presenta: la página la cambia quien la usa.
import type { Paginacion as DatosPaginacion } from '../tipos';

interface Propiedades {
  paginacion: DatosPaginacion;
  totalPaginas: number;
  alCambiar: (pagina: number) => void;
}

export function Paginacion({ paginacion, totalPaginas, alCambiar }: Propiedades) {
  const { pagina, porPagina, total } = paginacion;
  const desde = total === 0 ? 0 : (pagina - 1) * porPagina + 1;
  const hasta = Math.min(pagina * porPagina, total);
  return (
    <nav className="paginacion" aria-label="Páginas">
      <button
        type="button"
        className="boton"
        disabled={pagina <= 1}
        onClick={() => alCambiar(pagina - 1)}
      >
        Anterior
      </button>
      <span aria-live="polite">
        Página {pagina} de {totalPaginas} · {desde}–{hasta} de {total}
      </span>
      <button
        type="button"
        className="boton"
        disabled={pagina >= totalPaginas}
        onClick={() => alCambiar(pagina + 1)}
      >
        Siguiente
      </button>
    </nav>
  );
}
