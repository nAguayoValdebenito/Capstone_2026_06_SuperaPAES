// Al cambiar de sección, el foco va al contenido principal (que tiene tabindex -1), para que el
// lector de pantalla y el teclado empiecen por la página nueva y no por el menú. La primera carga no
// mueve el foco.
import { useEffect, useRef, type RefObject } from 'react';
import { useLocation } from 'react-router';

export function useFocoAlNavegar(principal: RefObject<HTMLElement | null>) {
  const { pathname } = useLocation();
  const anterior = useRef(pathname);
  useEffect(() => {
    if (anterior.current === pathname) return;
    anterior.current = pathname;
    principal.current?.focus({ preventScroll: true });
    window.scrollTo?.(0, 0);
  }, [pathname, principal]);
}
