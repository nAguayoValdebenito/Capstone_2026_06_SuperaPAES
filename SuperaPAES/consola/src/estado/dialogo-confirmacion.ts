// Diálogo de confirmación con <dialog> nativo (componentes/DialogoConfirmacion.tsx): se abre como
// modal cuando hay algo que confirmar, Escape lo cierra como «Cancelar» y el foco vuelve a quien lo
// abrió (lo hace el navegador al cerrar un diálogo modal).
import { useEffect, useRef } from 'react';

export function useDialogoModal(abierto: boolean, alCancelar: () => void) {
  const dialogo = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const elemento = dialogo.current;
    if (!elemento) return;
    if (abierto && !elemento.open) {
      if (typeof elemento.showModal === 'function') elemento.showModal();
      else elemento.setAttribute('open', '');
    } else if (!abierto && elemento.open) {
      if (typeof elemento.close === 'function') elemento.close();
      else elemento.removeAttribute('open');
    }
  }, [abierto]);

  // Escape dispara «cancel»: se evita el cierre propio para que el estado lo maneje quien lo usa.
  useEffect(() => {
    const elemento = dialogo.current;
    if (!elemento) return;
    const alCancelarDialogo = (evento: Event) => {
      evento.preventDefault();
      alCancelar();
    };
    elemento.addEventListener('cancel', alCancelarDialogo);
    return () => elemento.removeEventListener('cancel', alCancelarDialogo);
  }, [alCancelar]);

  return dialogo;
}
