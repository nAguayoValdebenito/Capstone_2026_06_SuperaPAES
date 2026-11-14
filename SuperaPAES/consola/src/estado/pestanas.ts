// Lógica de las pestañas (componentes/Pestanas.tsx): a qué pestaña lleva cada tecla y la línea bajo la
// elegida, que se mueve y cambia de ancho solo con transform (sin animar el ancho). La línea se vuelve a
// medir si cambia el tamaño de alguna pestaña (por ejemplo, cuando llega un conteo entre paréntesis).
import { useLayoutEffect, type RefObject } from 'react';

const DESPLAZAMIENTO: Record<string, (indice: number, total: number) => number> = {
  ArrowRight: (i, n) => (i + 1) % n,
  ArrowLeft: (i, n) => (i - 1 + n) % n,
  Home: () => 0,
  End: (_i, n) => n - 1,
};

/** El índice de la pestaña a la que lleva la tecla, o null si la tecla no mueve. */
export function indiceDestino(tecla: string, indice: number, total: number): number | null {
  const mover = DESPLAZAMIENTO[tecla];
  return mover && total > 0 ? mover(indice, total) : null;
}

export function useLineaDePestana(lista: RefObject<HTMLElement | null>, valor: unknown) {
  useLayoutEffect(() => {
    const contenedor = lista.current;
    const linea = contenedor?.querySelector<HTMLElement>('.pestanas__linea');
    if (!contenedor || !linea) return;
    const medir = () => {
      const elegida = contenedor.querySelector<HTMLElement>('[aria-selected="true"]');
      if (!elegida) return;
      linea.style.transform = `translateX(${String(elegida.offsetLeft)}px) scaleX(${String(elegida.offsetWidth)})`;
    };
    medir();
    if (typeof ResizeObserver === 'undefined') return;
    const observador = new ResizeObserver(medir);
    contenedor.querySelectorAll('[role="tab"]').forEach((pestana) => observador.observe(pestana));
    return () => observador.disconnect();
  }, [lista, valor]);
}
