// C02 · Banco de preguntas (HU-11, RF-G01): filtros por prueba, eje, contenido, habilidad, estado, origen
// y dificultad asignada; tabla con el estado de cada pregunta; de a páginas. La lógica está en
// src/estado/banco.ts. Las acciones de la tabla y la publicación de varias llegan con sus historias.
import { Paginacion } from '../../componentes/Paginacion';
import { type CargaBanco, totalDePaginas, useBanco } from '../../estado/banco';
import { FiltrosBanco } from './FiltrosBanco';
import { TablaBanco } from './TablaBanco';

function Alerta({ texto, codigo }: { texto: string; codigo: string }) {
  return (
    <p className="estado__error" role="alert">
      {texto} <span className="estado__codigo">({codigo})</span>
    </p>
  );
}

/** La página del banco según su carga: cargando, error de la API, sin resultados o la tabla. */
export function ResultadoBanco({
  carga,
  alCambiarPagina,
}: {
  carga: CargaBanco;
  alCambiarPagina: (pagina: number) => void;
}) {
  if (carga.tipo === 'cargando') return <p aria-live="polite">Cargando preguntas…</p>;
  if (carga.tipo === 'fallida') return <Alerta texto={carga.mensaje} codigo={carga.codigo} />;
  const { preguntas, paginacion } = carga.pagina;
  return (
    <>
      <TablaBanco preguntas={preguntas} />
      {paginacion.total > 0 && (
        <Paginacion
          paginacion={paginacion}
          totalPaginas={totalDePaginas(paginacion)}
          alCambiar={alCambiarPagina}
        />
      )}
    </>
  );
}

export function PaginaBanco() {
  const { opciones, carga, filtros, cambiarFiltro, limpiarFiltros, irAPagina } = useBanco();

  return (
    <section className="pagina pagina--ancha">
      <h1>Banco de preguntas</h1>
      <p className="pagina__aviso">
        Preguntas de todas las pruebas, con su estado. Filtra para encontrar las que debes trabajar.
      </p>
      {opciones.tipo === 'lista' && (
        <FiltrosBanco
          opciones={opciones.opciones}
          filtros={filtros}
          alCambiar={cambiarFiltro}
          alLimpiar={limpiarFiltros}
        />
      )}
      {opciones.tipo === 'fallida' && <Alerta texto={opciones.mensaje} codigo={opciones.codigo} />}
      <ResultadoBanco carga={carga} alCambiarPagina={irAPagina} />
    </section>
  );
}
