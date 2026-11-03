// C02 · Banco de preguntas (HU-11, RF-G01): filtros por prueba, eje, contenido, habilidad, estado, origen
// y dificultad asignada; tabla con el estado de cada pregunta; de a páginas. La lógica está en
// src/estado/banco.ts. Desde aquí se crea una pregunta (C03) o se importa un archivo (C04, HU-13.2), que
// vuelve con su aviso. Cada fila tiene la acción de su etapa: enviar a revisión (HU-21), publicar,
// retirar o volver a borrador (HU-24); la publicación de varias a la vez llega con HU-53.
import { Link } from 'react-router';
import { Paginacion } from '../../componentes/Paginacion';
import { useAvisoDeNavegacion } from '../../estado/aviso-de-navegacion';
import {
  type AccionesDelBanco,
  type AvisoDelBanco,
  useAccionesDelBanco,
} from '../../estado/acciones-banco';
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
  acciones,
}: {
  carga: CargaBanco;
  alCambiarPagina: (pagina: number) => void;
  acciones?: AccionesDelBanco;
}) {
  if (carga.tipo === 'cargando') return <p aria-live="polite">Cargando preguntas…</p>;
  if (carga.tipo === 'fallida') return <Alerta texto={carga.mensaje} codigo={carga.codigo} />;
  const { preguntas, paginacion } = carga.pagina;
  return (
    <>
      <TablaBanco preguntas={preguntas} acciones={acciones} />
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

/**
 * El aviso de lo último que pasó: el envío a revisión (HU-21) con quiénes la revisan, la publicación, el
 * retiro o la vuelta a borrador (HU-24), o por qué no se pudo; o lo que dejó la página anterior (por
 * ejemplo, la importación).
 */
function AvisoDeAccion({ aviso }: { aviso: AvisoDelBanco | null }) {
  if (!aviso) return null;
  return (
    <p className={`aviso aviso--${aviso.tipo}`} role={aviso.tipo === 'error' ? 'alert' : 'status'}>
      {aviso.texto}
    </p>
  );
}

export function PaginaBanco() {
  const { opciones, carga, filtros, cambiarFiltro, limpiarFiltros, irAPagina, recargar } =
    useBanco();
  const acciones = useAccionesDelBanco(recargar, useAvisoDeNavegacion());

  return (
    <section className="pagina pagina--ancha">
      <header className="pagina__encabezado">
        <div>
          <h1>Banco de preguntas</h1>
          <p className="pagina__aviso">
            Preguntas de todas las pruebas, con su estado. Filtra para encontrar las que debes
            trabajar.
          </p>
        </div>
        <div className="pagina__acciones">
          <Link className="boton" to="/banco/importar">
            Importar archivo
          </Link>
          <Link className="boton boton--primario" to="/banco/nueva">
            Nueva pregunta
          </Link>
        </div>
      </header>
      <AvisoDeAccion aviso={acciones.aviso} />
      {opciones.tipo === 'lista' && (
        <FiltrosBanco
          opciones={opciones.opciones}
          filtros={filtros}
          alCambiar={cambiarFiltro}
          alLimpiar={limpiarFiltros}
        />
      )}
      {opciones.tipo === 'fallida' && <Alerta texto={opciones.mensaje} codigo={opciones.codigo} />}
      <ResultadoBanco carga={carga} alCambiarPagina={irAPagina} acciones={acciones} />
    </section>
  );
}
