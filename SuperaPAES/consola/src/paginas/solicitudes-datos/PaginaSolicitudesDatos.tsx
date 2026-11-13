// Solicitudes de datos (C14, HU-55, RF-C10, Ley 21.719): las solicitudes de los estudiantes sobre sus
// datos personales, con las pendientes primero y la fecha límite más próxima arriba, la etiqueta de plazo
// en texto, el filtro por estado y el detalle en un panel lateral (como C13) con la respuesta o el
// rechazo y su confirmación. La lógica vive en estado/solicitudes-datos.ts.
import { useRef } from 'react';
import { Alerta } from '../../componentes/Alerta';
import { Paginacion } from '../../componentes/Paginacion';
import { Pestanas } from '../../componentes/Pestanas';
import {
  pestanasDeEstado,
  solicitudElegida,
  useSolicitudesDatos,
  type EstadoSolicitudesDatos,
} from '../../estado/solicitudes-datos';
import { totalDePaginas } from '../../servicios/paginacion';
import type { AtencionSolicitud, BandejaSolicitudes } from '../../tipos/solicitudes-datos';
import { ConfirmarAtencion } from './ConfirmarAtencion';
import { PanelSolicitud } from './PanelSolicitud';
import { TablaSolicitudes } from './TablaSolicitudes';
import './solicitudes-datos.css';

const VACIO = {
  pendiente: 'No hay solicitudes pendientes.',
  respondida: 'No hay solicitudes respondidas.',
  rechazada: 'No hay solicitudes rechazadas.',
} as const;

function Bandeja({ estado, datos }: { estado: EstadoSolicitudesDatos; datos: BandejaSolicitudes }) {
  const botonResponder = useRef<HTMLButtonElement>(null);
  const botonRechazar = useRef<HTMLButtonElement>(null);
  const solicitud = solicitudElegida(datos.solicitudes, estado.elegida);
  if (!solicitud) return <p className="solicitudes__vacio">{VACIO[estado.estado]}</p>;
  const { respuesta } = estado;
  const accion = respuesta.confirmacion;
  const cancelar = (abierta: AtencionSolicitud) => {
    respuesta.cancelar();
    const boton = abierta === 'respondida' ? botonResponder : botonRechazar;
    requestAnimationFrame(() => boton.current?.focus());
  };
  return (
    <>
      <div className="solicitudes__contenido">
        <div>
          <TablaSolicitudes
            solicitudes={datos.solicitudes}
            elegida={solicitud.id}
            alElegir={estado.elegir}
          />
          <Paginacion
            paginacion={datos.paginacion}
            totalPaginas={totalDePaginas(datos.paginacion)}
            alCambiar={estado.setPagina}
          />
        </div>
        <PanelSolicitud
          solicitud={solicitud}
          formulario={{ ...respuesta, enCurso: estado.enCurso }}
          botonResponder={botonResponder}
          botonRechazar={botonRechazar}
        />
      </div>
      {accion !== null && (
        <ConfirmarAtencion
          accion={accion}
          respuesta={respuesta.texto}
          enCurso={estado.enCurso}
          alConfirmar={() => void estado.confirmar(solicitud.id)}
          alCancelar={() => cancelar(accion)}
        />
      )}
    </>
  );
}

/** Las pestañas por estado, con el total de pendientes de la última carga. */
function PestanasEstado({ estado }: { estado: EstadoSolicitudesDatos }) {
  const pendientes = estado.carga.tipo === 'lista' ? estado.carga.datos.pendientes : 0;
  return (
    <Pestanas
      etiqueta="Estado de las solicitudes"
      opciones={pestanasDeEstado(pendientes)}
      valor={estado.estado}
      alElegir={estado.cambiarEstado}
    />
  );
}

/** La bandeja según la carga: cargando, error con reintento o las solicitudes. */
export function VistaSolicitudes({ estado }: { estado: EstadoSolicitudesDatos }) {
  const { carga, mensaje } = estado;
  return (
    <section className="pagina pagina--ancha solicitudes">
      <h1>Solicitudes de datos</h1>
      <p className="pagina__aviso">
        Derechos de la Ley 21.719 que piden los estudiantes desde la app, con su plazo legal de
        respuesta.
      </p>
      <PestanasEstado estado={estado} />
      {mensaje && (
        <p
          className={`aviso aviso--${mensaje.tipo}`}
          role={mensaje.tipo === 'error' ? 'alert' : 'status'}
        >
          {mensaje.texto}
        </p>
      )}
      {carga.tipo === 'cargando' && <p aria-live="polite">Cargando solicitudes…</p>}
      {carga.tipo === 'fallida' && (
        <div className="solicitudes__error">
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

export function PaginaSolicitudesDatos() {
  return <VistaSolicitudes estado={useSolicitudesDatos()} />;
}
