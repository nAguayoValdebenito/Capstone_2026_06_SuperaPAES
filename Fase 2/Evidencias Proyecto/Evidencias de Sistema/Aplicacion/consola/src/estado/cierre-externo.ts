// Cierra un panel desplegable con Escape (devolviendo el foco a su botón) o con un clic fuera de él.
import { useEffect, type RefObject } from 'react';

export function useCierreExterno(
  contenedor: RefObject<HTMLElement | null>,
  abierto: boolean,
  cerrar: (devolverFoco: boolean) => void,
) {
  useEffect(() => {
    if (!abierto) return;
    const alPresionar = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') cerrar(true);
    };
    const alHacerClic = (evento: MouseEvent) => {
      if (evento.target instanceof Node && !contenedor.current?.contains(evento.target))
        cerrar(false);
    };
    document.addEventListener('keydown', alPresionar);
    document.addEventListener('mousedown', alHacerClic);
    return () => {
      document.removeEventListener('keydown', alPresionar);
      document.removeEventListener('mousedown', alHacerClic);
    };
  }, [contenedor, abierto, cerrar]);
}
