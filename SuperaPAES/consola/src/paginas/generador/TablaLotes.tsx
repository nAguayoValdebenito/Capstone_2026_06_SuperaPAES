// Lotes anteriores de C05, incluidos los fallidos. Elegir uno muestra su resultado.
import { Paginacion } from '../../componentes/Paginacion';
import { totalDePaginas } from '../../servicios/paginacion';
import type { PruebaTemario } from '../../tipos';
import type { Lote, PaginaLotes } from '../../tipos/generador';
import { ESTADOS_LOTE, fechaDeLote, ubicarContenido } from '../../utilidades/generador';

const COLUMNAS = ['Lote', 'Fecha', 'Contenido', 'Estado', 'Válidas', 'Descartadas', 'Acciones'];

function FilaLote({
  lote,
  pruebas,
  elegido,
  alElegir,
}: {
  lote: Lote;
  pruebas: readonly PruebaTemario[];
  elegido: boolean;
  alElegir: (id: string) => void;
}) {
  return (
    <tr>
      <th scope="row">{lote.id}</th>
      <td>{fechaDeLote(lote.creadoEn)}</td>
      <td>{ubicarContenido(pruebas, lote.contenidoId)?.contenido.nombre ?? '—'}</td>
      <td>
        <span className={`etiqueta etiqueta--${lote.estado}`}>{ESTADOS_LOTE[lote.estado]}</span>
      </td>
      <td>{lote.validas}</td>
      <td>{lote.descartadas}</td>
      <td>
        <button
          type="button"
          className="boton"
          disabled={elegido}
          onClick={() => alElegir(lote.id)}
        >
          {elegido ? 'Viendo' : 'Ver'}
        </button>
      </td>
    </tr>
  );
}

export function TablaLotes({
  datos,
  pruebas,
  elegidoId,
  alElegir,
  alCambiarPagina,
}: {
  datos: PaginaLotes;
  pruebas: readonly PruebaTemario[];
  elegidoId: string | undefined;
  alElegir: (id: string) => void;
  alCambiarPagina: (pagina: number) => void;
}) {
  if (datos.lotes.length === 0) return null;
  return (
    <section className="generador__lotes" aria-label="Lotes anteriores">
      <h2>Lotes anteriores</h2>
      <div className="tabla-desplazable">
        <table className="tabla">
          <thead>
            <tr>
              {COLUMNAS.map((columna) => (
                <th key={columna} scope="col">
                  {columna}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {datos.lotes.map((lote) => (
              <FilaLote
                key={lote.id}
                lote={lote}
                pruebas={pruebas}
                elegido={lote.id === elegidoId}
                alElegir={alElegir}
              />
            ))}
          </tbody>
        </table>
      </div>
      <Paginacion
        paginacion={datos.paginacion}
        totalPaginas={totalDePaginas(datos.paginacion)}
        alCambiar={alCambiarPagina}
      />
    </section>
  );
}
