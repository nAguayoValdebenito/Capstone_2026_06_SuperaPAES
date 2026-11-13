// Detalle de la solicitud elegida en C14: qué pidió el estudiante, sus fechas y, si está pendiente, el
// formulario de respuesta (HU-55 esc. 2) con el texto obligatorio. Una atendida muestra la respuesta,
// quién la atendió y cuándo, sin formulario.
import type { Ref } from 'react';
import { estudianteDe, fechaChilena, quienAtendio } from '../../estado/solicitudes-datos';
import type { AtencionSolicitud, SolicitudDeDatos } from '../../tipos/solicitudes-datos';
import { EtiquetaPlazo } from './TablaSolicitudes';

export interface FormularioRespuesta {
  texto: string;
  error: string | null;
  enCurso: boolean;
  escribir: (valor: string) => void;
  pedirConfirmacion: (accion: AtencionSolicitud) => void;
}

/** Los botones del formulario, para devolverles el foco al cerrar la confirmación. */
interface BotonesFormulario {
  botonResponder: Ref<HTMLButtonElement>;
  botonRechazar: Ref<HTMLButtonElement>;
}

/** El texto obligatorio, con su ayuda y su error unidos al campo. */
function CampoRespuesta({ texto, error, escribir }: FormularioRespuesta) {
  const describe = `solicitud-respuesta-ayuda${error ? ' solicitud-respuesta-error' : ''}`;
  return (
    <>
      <label className="campo" htmlFor="solicitud-respuesta">
        Respuesta al estudiante
        <textarea
          id="solicitud-respuesta"
          rows={5}
          value={texto}
          aria-invalid={error ? true : undefined}
          aria-describedby={describe}
          onChange={(evento) => escribir(evento.target.value)}
        />
      </label>
      <p id="solicitud-respuesta-ayuda" className="campo__ayuda">
        Obligatoria para responder o rechazar. El estudiante la verá en la app.
      </p>
      {error && (
        <p id="solicitud-respuesta-error" className="campo__error">
          {error}
        </p>
      )}
    </>
  );
}

function Formulario({
  formulario,
  botonResponder,
  botonRechazar,
}: { formulario: FormularioRespuesta } & BotonesFormulario) {
  const { enCurso, pedirConfirmacion } = formulario;
  return (
    <div className="solicitudes__formulario">
      <CampoRespuesta {...formulario} />
      <div className="pagina__acciones">
        <button
          type="button"
          ref={botonResponder}
          className="boton boton--primario"
          disabled={enCurso}
          onClick={() => pedirConfirmacion('respondida')}
        >
          Responder
        </button>
        <button
          type="button"
          ref={botonRechazar}
          className="boton"
          disabled={enCurso}
          onClick={() => pedirConfirmacion('rechazada')}
        >
          Rechazar
        </button>
      </div>
      <p className="solicitudes__dato">Queda registrado quién la atendió y cuándo.</p>
    </div>
  );
}

function Atendida({ solicitud }: { solicitud: SolicitudDeDatos }) {
  return (
    <div className="solicitudes__formulario">
      <p className="solicitudes__cabecera">
        <strong>Respuesta</strong>
        <span className="etiqueta">{solicitud.estado.nombre}</span>
      </p>
      <blockquote className="solicitudes__cita">{solicitud.respuesta}</blockquote>
      <p className="solicitudes__dato">{quienAtendio(solicitud)}</p>
    </div>
  );
}

export function PanelSolicitud({
  solicitud,
  formulario,
  botonResponder,
  botonRechazar,
}: {
  solicitud: SolicitudDeDatos;
  formulario: FormularioRespuesta;
} & BotonesFormulario) {
  const pendiente = solicitud.estado.codigo === 'pendiente';
  return (
    <section className="panel solicitudes__panel" aria-labelledby="solicitud-titulo">
      <h2 id="solicitud-titulo">{`${solicitud.tipo.nombre} · ${estudianteDe(solicitud)}`}</h2>
      <p className="solicitudes__dato">
        {`Recibida el ${fechaChilena(solicitud.solicitadoEn)} · fecha límite ${fechaChilena(solicitud.venceEn)}`}{' '}
        <EtiquetaPlazo solicitud={solicitud} />
      </p>
      {solicitud.estudiante.cuentaEliminada && pendiente && (
        <p className="solicitudes__dato">
          La cuenta fue eliminada: el estudiante no podrá ver la respuesta.
        </p>
      )}
      <blockquote className="solicitudes__cita">{solicitud.detalle ?? 'Sin detalle.'}</blockquote>
      {pendiente ? (
        <Formulario
          formulario={formulario}
          botonResponder={botonResponder}
          botonRechazar={botonRechazar}
        />
      ) : (
        <Atendida solicitud={solicitud} />
      )}
    </section>
  );
}
