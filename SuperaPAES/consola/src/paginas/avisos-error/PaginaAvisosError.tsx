// Avisos de error (C13, HU-50, RF-C08, CU-26, CU-26a): la bandeja de avisos que envían los estudiantes,
// agrupada por pregunta y filtrable por estado y motivo, con acceso a la pregunta (C03), el cierre de
// cada aviso y la anulación de la pregunta con una confirmación fuerte. La lógica vive en
// estado/avisos-error.ts.
import { useRef } from 'react';
import { Alerta } from '../../componentes/Alerta';
import { Paginacion } from '../../componentes/Paginacion';
import { Selector } from '../../componentes/Selector';
import {
  ESTADOS_FILTRO,
  grupoElegido,
  useAvisosError,
  type EstadoAvisosError,
} from '../../estado/avisos-error';
import { totalDePaginas } from '../../servicios/paginacion';
import type { PaginaDeAvisos } from '../../tipos/avisos-error';
import { deLista } from '../../utilidades/opciones';
import { ConfirmarAnulacion } from './ConfirmarAnulacion';
import { PanelPregunta } from './PanelPregunta';
import { TablaAvisos } from './TablaAvisos';
import './avisos-error.css';

function Filtros({ estado }: { estado: EstadoAvisosError }) {
  const { filtros, cambiarFiltro, motivos } = estado;
  return (
    <div className="filtros" role="search" aria-label="Filtrar avisos">
      <Selector
        etiqueta="Estado"
        valor={filtros.estado}
        opciones={ESTADOS_FILTRO}
        textoVacio={null}
        alCambiar={(valor) => cambiarFiltro('estado', valor)}
      />
      <Selector
        etiqueta="Motivo"
        valor={filtros.motivo}
        opciones={motivos.tipo === 'lista' ? deLista(motivos.datos) : []}
        alCambiar={(valor) => cambiarFiltro('motivo', valor)}
      />
    </div>
  );
}

function Bandeja({ estado, datos }: { estado: EstadoAvisosError; datos: PaginaDeAvisos }) {
  const botonAnular = useRef<HTMLButtonElement>(null);
  const grupo = grupoElegido(datos.grupos, estado.elegida);
  if (!grupo) {
    const vacio =
      estado.filtros.estado === 'pendiente'
        ? 'No hay avisos pendientes.'
        : 'No hay avisos con estos filtros.';
    return <p className="avisos__vacio">{vacio}</p>;
  }
  const { anulacion } = estado;
  const cancelar = () => {
    anulacion.cerrar();
    requestAnimationFrame(() => botonAnular.current?.focus());
  };
  return (
    <>
      <div className="avisos__contenido">
        <div>
          <TablaAvisos grupos={datos.grupos} elegida={grupo.pregunta.id} alElegir={estado.elegir} />
          <Paginacion
            paginacion={datos.paginacion}
            totalPaginas={totalDePaginas(datos.paginacion)}
            alCambiar={estado.setPagina}
          />
        </div>
        <PanelPregunta
          grupo={grupo}
          enCurso={estado.enCurso}
          alCerrar={(aviso, cierre) => void estado.cerrar(aviso, cierre)}
          botonAnular={botonAnular}
          alAnular={() => anulacion.abrir(grupo.pregunta.id)}
        />
      </div>
      {anulacion.preguntaId !== null && (
        <ConfirmarAnulacion
          preguntaId={anulacion.preguntaId}
          impacto={anulacion.impacto}
          enCurso={estado.enCurso}
          alConfirmar={() => void anulacion.confirmar()}
          alCancelar={cancelar}
        />
      )}
    </>
  );
}

/** La bandeja según la carga: cargando, error con reintento o los avisos. */
export function VistaAvisos({ estado }: { estado: EstadoAvisosError }) {
  const { carga, mensaje } = estado;
  return (
    <section className="pagina pagina--ancha avisos">
      <h1>Avisos de error</h1>
      <p className="pagina__aviso">Enviados por los estudiantes desde la app.</p>
      <Filtros estado={estado} />
      {mensaje && (
        <p
          className={`aviso aviso--${mensaje.tipo}`}
          role={mensaje.tipo === 'error' ? 'alert' : 'status'}
        >
          {mensaje.texto}
        </p>
      )}
      {carga.tipo === 'cargando' && <p aria-live="polite">Cargando avisos…</p>}
      {carga.tipo === 'fallida' && (
        <div className="avisos__error">
          <Alerta texto={carga.mensaje} codigo={carga.codigo} />
          <button type="button" className="boton" onClick={estado.reintentar}>
            Reintentar
          </button>
        </div>
      )}
      {carga.tipo === 'lista' && <Bandeja estado={estado} datos={carga.datos} />}
    </section>
  );
}

export function PaginaAvisosError() {
  return <VistaAvisos estado={useAvisosError()} />;
}
