import type { KeyboardEvent, RefObject } from 'react';

type RefBoton = RefObject<HTMLButtonElement | null>;

/** Mantiene el foco en la confirmación; Escape vuelve al botón que la abrió. */
export function manejarTeclaConfiguracion(
  evento: KeyboardEvent,
  controles: { cancelar: RefBoton; aceptar: RefBoton },
  guardando: boolean,
  alCancelar: () => void,
) {
  const { cancelar, aceptar } = controles;
  if (evento.key === 'Escape' && !guardando) alCancelar();
  if (evento.key !== 'Tab') return;
  if (evento.shiftKey && document.activeElement === cancelar.current) {
    evento.preventDefault();
    aceptar.current?.focus();
  } else if (!evento.shiftKey && document.activeElement === aceptar.current) {
    evento.preventDefault();
    cancelar.current?.focus();
  }
}
