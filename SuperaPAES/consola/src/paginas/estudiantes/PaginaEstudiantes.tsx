// C15 · Estudiantes: todos los estudiantes registrados, con o sin suscripción, en una tabla que se carga
// al entrar, del registro más reciente al más antiguo y paginada desde la API. Los filtros opcionales
// (suscripción, interés y cuenta verificada) se eligen de una lista. Si no le llegó el correo de
// verificación, el administrador confirma la cuenta (HU-05 esc. 4, CU-02b). La lógica vive en
// estado/estudiantes.ts.
import { Alerta } from '../../componentes/Alerta';
import { Paginacion } from '../../componentes/Paginacion';
import { Selector } from '../../componentes/Selector';
import {
  conConfirmados,
  hayFiltros,
  OPCIONES_SUSCRIPCION,
  OPCIONES_VERIFICADO,
  opcionesInteres,
  textoSinEstudiantes,
  useEstudiantes,
  type EstadoEstudiantes,
} from '../../estado/estudiantes';
import type { FiltrosEstudiantes } from '../../tipos/estudiantes';
import { totalDePaginas } from '../../servicios/paginacion';
import { TablaEstudiantes } from './TablaEstudiantes';
import './estudiantes.css';

function Filtros({ estado }: { estado: EstadoEstudiantes }) {
  const { filtros, areas, cambiarFiltro } = estado;
  return (
    <div className="filtros" role="group" aria-label="Filtrar estudiantes">
      <Selector
        etiqueta="Suscripción"
        valor={filtros.suscripcion}
        opciones={OPCIONES_SUSCRIPCION}
        alCambiar={(valor) =>
          cambiarFiltro('suscripcion', valor as FiltrosEstudiantes['suscripcion'])
        }
      />
      <Selector
        etiqueta="Interés"
        valor={filtros.interes}
        opciones={areas.tipo === 'lista' ? opcionesInteres(areas.datos) : []}
        deshabilitado={areas.tipo !== 'lista'}
        alCambiar={(valor) => cambiarFiltro('interes', valor)}
      />
      <Selector
        etiqueta="Cuenta"
        valor={filtros.verificado}
        opciones={OPCIONES_VERIFICADO}
        alCambiar={(valor) =>
          cambiarFiltro('verificado', valor as FiltrosEstudiantes['verificado'])
        }
      />
      {hayFiltros(filtros) && (
        <button type="button" className="boton filtros__limpiar" onClick={estado.limpiarFiltros}>
          Limpiar filtros
        </button>
      )}
    </div>
  );
}

function Listado({ estado }: { estado: EstadoEstudiantes }) {
  const { carga } = estado;
  if (carga.tipo === 'cargando') return <p aria-live="polite">Cargando estudiantes…</p>;
  if (carga.tipo === 'fallida') {
    return (
      <div className="estudiantes__error">
        <Alerta texto={carga.mensaje} codigo={carga.codigo} />
        <button type="button" className="boton" onClick={estado.reintentar}>
          Reintentar
        </button>
      </div>
    );
  }
  const { estudiantes, paginacion } = carga.datos;
  if (estudiantes.length === 0 && paginacion.total === 0) {
    return <p className="estudiantes__vacio">{textoSinEstudiantes(estado.filtros)}</p>;
  }
  return (
    <>
      <TablaEstudiantes
        estudiantes={conConfirmados(estudiantes, estado.confirmados)}
        confirmando={estado.confirmando}
        alConfirmar={(id) => void estado.confirmar(id)}
      />
      <Paginacion
        paginacion={paginacion}
        totalPaginas={totalDePaginas(paginacion)}
        alCambiar={estado.setPagina}
      />
    </>
  );
}

export function VistaEstudiantes({ estado }: { estado: EstadoEstudiantes }) {
  return (
    <section className="pagina pagina--ancha">
      <h1>Estudiantes</h1>
      <p className="pagina__aviso">
        Todos los estudiantes registrados en la app, del más reciente al más antiguo. Si a alguno no
        le llegó el correo de verificación, confirma su cuenta y su cupo diario sube a 20 preguntas.
      </p>
      <Filtros estado={estado} />
      {estado.error && <Alerta texto={estado.error} />}
      {estado.aviso && (
        <p className="estado__ok" role="status">
          {estado.aviso}
        </p>
      )}
      <Listado estado={estado} />
    </section>
  );
}

export function PaginaEstudiantes() {
  return <VistaEstudiantes estado={useEstudiantes()} />;
}
