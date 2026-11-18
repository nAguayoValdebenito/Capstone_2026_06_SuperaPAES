// C02 · Banco de preguntas (HU-11, RF-G01): filtros por prueba, eje, contenido, habilidad, estado, origen
// y dificultad asignada; tabla con el estado de cada pregunta; de a páginas. La lógica está en
// src/estado/banco.ts. Desde aquí se crea una pregunta (C03) o se importa un archivo (C04, HU-13.2), que
// vuelve con su aviso. Cada fila tiene la acción de su etapa: enviar a revisión (HU-21), publicar,
// retirar o volver a borrador (HU-24); la publicación de varias a la vez llega con HU-53. Arriba van las
// confirmadas en calibración (HU-26.2) y la tabla suma las estadísticas de cada pregunta (HU-53). Sobre la
// barra de acciones van las acciones en lote para llenar la app de pruebas: enviar a revisión y aceptar
// y publicar, 10 preguntas por clic con los filtros puestos, en todo el banco.
import { Link } from 'react-router';
import { Paginacion } from '../../componentes/Paginacion';
import { DialogoConfirmacion } from '../../componentes/DialogoConfirmacion';
import { useAvisoDeNavegacion } from '../../estado/aviso-de-navegacion';
import {
  type AccionesDelBanco,
  type AvisoDelBanco,
  useAccionesDelBanco,
} from '../../estado/acciones-banco';
import { type CargaBanco, totalDePaginas, useBanco } from '../../estado/banco';
import { useConfirmadas, useEstadisticasDelBanco } from '../../estado/calibracion';
import { type AccionesEnLote, useAccionesEnLote } from '../../estado/acciones-lote-banco';
import type { EstadisticaPregunta } from '../../tipos/calibracion';
import { BotonesEnLote } from './AccionesEnLote';
import { ConfirmadasCalibracion } from './ConfirmadasCalibracion';
import { FiltrosBanco } from './FiltrosBanco';
import './banco.css';
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
  estadisticas,
  alLimpiar,
}: {
  carga: CargaBanco;
  alCambiarPagina: (pagina: number) => void;
  acciones?: AccionesDelBanco;
  estadisticas?: ReadonlyMap<string, EstadisticaPregunta>;
  /** Con filtros activos, el estado vacío ofrece limpiarlos. */
  alLimpiar?: () => void;
}) {
  if (carga.tipo === 'cargando')
    return (
      <p className="cargando" aria-live="polite">
        Cargando preguntas…
      </p>
    );
  if (carga.tipo === 'fallida') return <Alerta texto={carga.mensaje} codigo={carga.codigo} />;
  const { preguntas, paginacion } = carga.pagina;
  return (
    <>
      <TablaBanco
        preguntas={preguntas}
        acciones={acciones}
        estadisticas={estadisticas}
        alLimpiar={alLimpiar}
      />
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

/** Retirar saca la pregunta de la app: se confirma antes, con su consecuencia. */
function DialogoRetiro({ acciones }: { acciones: ReturnType<typeof useAccionesDelBanco> }) {
  const id = acciones.porRetirar;
  return (
    <DialogoConfirmacion
      abierto={id !== null}
      titulo={`¿Retirar la pregunta ${String(id ?? '')}?`}
      textoConfirmar="Retirar"
      peligro
      alConfirmar={acciones.confirmarRetiro}
      alCancelar={acciones.cancelarRetiro}
    >
      <p>
        Deja de llegar a la app desde ahora. Para publicarla otra vez tendrá que volver a borrador y
        pasar de nuevo por revisión.
      </p>
    </DialogoConfirmacion>
  );
}

/**
 * La barra de acciones del banco, en la tarjeta de los filtros: las dos acciones en lote (10 por clic con
 * los filtros), importar un archivo (C04) y crear una pregunta (C03).
 */
function AccionesBanco({ lote }: { lote: AccionesEnLote }) {
  return (
    <>
      <BotonesEnLote acciones={lote} />
      <Link className="boton" to="/banco/importar">
        Importar archivo
      </Link>
      <Link className="boton boton--primario" to="/banco/nueva">
        Nueva pregunta
      </Link>
    </>
  );
}

function EncabezadoBanco() {
  return (
    <header className="pagina__encabezado">
      <div>
        <h1>Banco de preguntas</h1>
        <p className="pagina__aviso">
          Preguntas de todas las pruebas, con su estado. Filtra para encontrar las que debes
          trabajar.
        </p>
      </div>
    </header>
  );
}

export function PaginaBanco() {
  const { opciones, carga, filtros, cambiarFiltro, limpiarFiltros, irAPagina, recargar, vuelta } =
    useBanco();
  const acciones = useAccionesDelBanco(recargar, useAvisoDeNavegacion());
  const lote = useAccionesEnLote(filtros, vuelta, recargar);
  const confirmadas = useConfirmadas(vuelta);
  const hayFiltros = Object.keys(filtros).length > 0;
  const estadisticas = useEstadisticasDelBanco(
    carga.tipo === 'lista' ? carga.pagina.preguntas.map((pregunta) => pregunta.id) : [],
  );

  return (
    <section className="pagina pagina--ancha">
      <EncabezadoBanco />
      <AvisoDeAccion aviso={lote.aviso} />
      <AvisoDeAccion aviso={acciones.aviso} />
      <ConfirmadasCalibracion carga={confirmadas} acciones={acciones} />
      {opciones.tipo === 'lista' ? (
        <FiltrosBanco
          opciones={opciones.opciones}
          filtros={filtros}
          alCambiar={cambiarFiltro}
          alLimpiar={limpiarFiltros}
          acciones={<AccionesBanco lote={lote} />}
        />
      ) : (
        <div className="filtros banco__filtros">
          <div className="banco__botonera">
            <AccionesBanco lote={lote} />
          </div>
        </div>
      )}
      {opciones.tipo === 'fallida' && <Alerta texto={opciones.mensaje} codigo={opciones.codigo} />}
      <ResultadoBanco
        carga={carga}
        alCambiarPagina={irAPagina}
        acciones={acciones}
        estadisticas={estadisticas}
        alLimpiar={hayFiltros ? limpiarFiltros : undefined}
      />
      <DialogoRetiro acciones={acciones} />
    </section>
  );
}
