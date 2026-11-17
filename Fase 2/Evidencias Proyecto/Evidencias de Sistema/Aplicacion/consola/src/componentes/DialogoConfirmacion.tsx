// Confirmación de una acción que hoy no se podía deshacer sin otra acción (retirar una pregunta,
// desactivar una cuenta o un plan): título, la consecuencia y dos botones. Cancelar recibe el foco
// inicial; Escape cancela. La acción la ejecuta quien lo usa en alConfirmar.
import { useId, type ReactNode } from 'react';
import { useDialogoModal } from '../estado/dialogo-confirmacion';

interface Propiedades {
  abierto: boolean;
  titulo: string;
  /** La consecuencia de confirmar, en una o dos frases. */
  children: ReactNode;
  textoConfirmar: string;
  /** La acción quita o detiene algo: el botón de confirmar va en granate. */
  peligro?: boolean;
  alConfirmar: () => void;
  alCancelar: () => void;
}

export function DialogoConfirmacion({
  abierto,
  titulo,
  children,
  textoConfirmar,
  peligro = false,
  alConfirmar,
  alCancelar,
}: Propiedades) {
  const id = useId();
  const dialogo = useDialogoModal(abierto, alCancelar);
  return (
    <dialog
      ref={dialogo}
      className="dialogo"
      aria-labelledby={`${id}-titulo`}
      aria-describedby={`${id}-efecto`}
      onKeyDown={(evento) => {
        // Escape cancela (y evita el cierre propio del navegador, que dejaría el estado abierto).
        if (evento.key !== 'Escape') return;
        evento.preventDefault();
        alCancelar();
      }}
    >
      {abierto && (
        <div className="dialogo__cuerpo">
          <h2 id={`${id}-titulo`}>{titulo}</h2>
          <div id={`${id}-efecto`}>{children}</div>
          <div className="dialogo__acciones">
            {/* autoFocus: el foco inicial queda en la opción que no cambia nada. */}
            <button type="button" className="boton" onClick={alCancelar} autoFocus>
              Cancelar
            </button>
            <button
              type="button"
              className={peligro ? 'boton boton--peligro-solido' : 'boton boton--primario'}
              onClick={alConfirmar}
            >
              {textoConfirmar}
            </button>
          </div>
        </div>
      )}
    </dialog>
  );
}
