// C16 · Suscripciones (HU-56, CU-27, RF-C09, RN-17, RN-26): trazabilidad completa de cada suscripción.
// Tarjetas del mes, filtros, la lista con la línea de tiempo de la elegida al lado, la bandeja de avisos
// con error y, al pie, las suscripciones por plan y estado y los pagos de cada mes. Nunca muestra datos de
// tarjetas. La lógica está en src/estado/suscripciones.ts.
import { Paginacion } from '../../componentes/Paginacion';
import { SegunCarga } from '../../componentes/SegunCarga';
import { useSuscripciones } from '../../estado/suscripciones';
import { totalDePaginas } from '../../servicios/paginacion';
import type { Paginacion as DatosPaginacion } from '../../tipos';
import { AvisosConError } from './AvisosConError';
import { FiltrosSuscripciones } from './FiltrosSuscripciones';
import { LineaDeTiempo } from './LineaDeTiempo';
import { ResumenPorPlanYMes, TarjetasDelMes } from './ResumenSuscripciones';
import { TablaSuscripciones } from './TablaSuscripciones';

function Paginas({
  paginacion,
  alCambiar,
}: {
  paginacion: DatosPaginacion;
  alCambiar: (pagina: number) => void;
}) {
  // Como en el banco: con resultados siempre se ve, para volver si la página pedida quedó vacía.
  if (paginacion.total === 0) return null;
  return (
    <Paginacion
      paginacion={paginacion}
      totalPaginas={totalDePaginas(paginacion)}
      alCambiar={alCambiar}
    />
  );
}

type Suscripciones = ReturnType<typeof useSuscripciones>;

/** Título, «Modo de prueba» y el botón que abre o cierra la bandeja de avisos con error. */
function Encabezado({
  vista,
  resumen,
  acciones,
}: Pick<Suscripciones, 'vista' | 'resumen' | 'acciones'>) {
  const conError = resumen.tipo === 'lista' ? ` (${String(resumen.datos.avisosConError)})` : '';
  return (
    <header className="pagina__encabezado">
      <div>
        <h1>Suscripciones</h1>
        <p className="pagina__aviso">
          Trazabilidad completa de cada suscripción. Nunca se muestran datos de tarjetas.
        </p>
      </div>
      <div className="pagina__acciones">
        <span className="etiqueta etiqueta--prueba">Modo de prueba</span>
        <button
          type="button"
          className="boton"
          aria-pressed={vista.avisos !== undefined}
          onClick={acciones.alternarAvisos}
        >
          Avisos con error{conError}
        </button>
      </div>
    </header>
  );
}

/** La lista de una página y, al lado, la línea de tiempo de la suscripción elegida. */
function ListaYLineaDeTiempo({
  vista,
  lista,
  detalle,
  acciones,
}: Pick<Suscripciones, 'vista' | 'lista' | 'detalle' | 'acciones'>) {
  return (
    <div className="suscripciones">
      <div>
        <SegunCarga carga={lista} cargando="Cargando suscripciones…">
          {({ suscripciones, paginacion }) => (
            <>
              <TablaSuscripciones
                suscripciones={suscripciones}
                elegida={vista.ver}
                alVer={acciones.ver}
              />
              <Paginas paginacion={paginacion} alCambiar={acciones.irAPagina} />
            </>
          )}
        </SegunCarga>
      </div>
      {vista.ver !== undefined && (
        <SegunCarga carga={detalle} cargando="Cargando la línea de tiempo…">
          {(datos) => <LineaDeTiempo detalle={datos} />}
        </SegunCarga>
      )}
    </div>
  );
}

export function PaginaSuscripciones() {
  const { vista, resumen, lista, detalle, bandeja, acciones } = useSuscripciones();
  return (
    <section className="pagina pagina--ancha">
      <Encabezado vista={vista} resumen={resumen} acciones={acciones} />
      <SegunCarga carga={resumen} cargando="Cargando el resumen…">
        {(datos) => (
          <>
            <TarjetasDelMes resumen={datos} />
            <FiltrosSuscripciones opciones={datos} filtros={vista.filtros} acciones={acciones} />
          </>
        )}
      </SegunCarga>
      {vista.avisos !== undefined && (
        <SegunCarga carga={bandeja} cargando="Cargando los avisos con error…">
          {({ avisos, paginacion }) => (
            <>
              <AvisosConError avisos={avisos} alVer={acciones.ver} />
              <Paginas paginacion={paginacion} alCambiar={acciones.irAPaginaDeAvisos} />
            </>
          )}
        </SegunCarga>
      )}
      <ListaYLineaDeTiempo vista={vista} lista={lista} detalle={detalle} acciones={acciones} />
      {resumen.tipo === 'lista' && <ResumenPorPlanYMes resumen={resumen.datos} />}
    </section>
  );
}
