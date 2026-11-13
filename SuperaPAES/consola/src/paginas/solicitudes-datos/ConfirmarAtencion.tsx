// Confirmación antes de responder o rechazar una solicitud (HU-55 esc. 2): repite la acción y el texto.
// El foco empieza en Cancelar y no sale del diálogo; Escape o Cancelar lo cierran sin enviar nada, y
// quien lo abre devuelve el foco al botón que lo abrió.
import { useEffect, useRef, type RefObject } from 'react';
import { manejarTeclaConfiguracion } from '../../estado/configuracion-teclado';
import type { AtencionSolicitud } from '../../tipos/solicitudes-datos';

const TEXTOS: Record<AtencionSolicitud, { titulo: string; boton: string }> = {
  respondida: { titulo: '¿Responder la solicitud?', boton: 'Responder' },
  rechazada: { titulo: '¿Rechazar la solicitud?', boton: 'Rechazar' },
};

type RefBoton = RefObject<HTMLButtonElement | null>;

function Botones({
  cancelar,
  aceptar,
  texto,
  enCurso,
  alConfirmar,
  alCancelar,
}: {
  cancelar: RefBoton;
  aceptar: RefBoton;
  texto: string;
  enCurso: boolean;
  alConfirmar: () => void;
  alCancelar: () => void;
}) {
  return (
    <div className="pagina__acciones">
      <button
        type="button"
        ref={cancelar}
        className="boton"
        disabled={enCurso}
        onClick={alCancelar}
      >
        Cancelar
      </button>
      <button
        type="button"
        ref={aceptar}
        className="boton boton--primario"
        disabled={enCurso}
        onClick={alConfirmar}
      >
        {texto}
      </button>
    </div>
  );
}

export function ConfirmarAtencion({
  accion,
  respuesta,
  enCurso,
  alConfirmar,
  alCancelar,
}: {
  accion: AtencionSolicitud;
  respuesta: string;
  enCurso: boolean;
  alConfirmar: () => void;
  alCancelar: () => void;
}) {
  const cancelar = useRef<HTMLButtonElement>(null);
  const aceptar = useRef<HTMLButtonElement>(null);
  useEffect(() => cancelar.current?.focus(), []);
  const { titulo, boton } = TEXTOS[accion];
  return (
    <div className="solicitudes__fondo">
      <div
        className="panel solicitudes__confirmacion"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="solicitud-confirmar-titulo"
        aria-describedby="solicitud-confirmar-detalle"
        onKeyDown={(evento) =>
          manejarTeclaConfiguracion(evento, { cancelar, aceptar }, enCurso, alCancelar)
        }
      >
        <h2 id="solicitud-confirmar-titulo">{titulo}</h2>
        <div id="solicitud-confirmar-detalle">
          <p>
            El estudiante verá este texto en la app, y queda registrado quién la atendió y cuándo:
          </p>
          <blockquote className="solicitudes__cita">{respuesta.trim()}</blockquote>
        </div>
        <Botones
          cancelar={cancelar}
          aceptar={aceptar}
          texto={boton}
          enCurso={enCurso}
          alConfirmar={alConfirmar}
          alCancelar={alCancelar}
        />
      </div>
    </div>
  );
}
