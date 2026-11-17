// Menú lateral como cajón en pantallas de 900 px o menos: se abre con el botón de la barra, se cierra
// con Escape, con el velo o al elegir una sección, y el foco vuelve al botón. Cerrado, el menú queda
// inerte (no recibe foco ni lo lee el lector de pantalla).
import { useCallback, useEffect, useState, type RefObject } from 'react';
import { useLocation } from 'react-router';

const CONSULTA_TELEFONO = '(max-width: 56.25rem)';

/** Si la pantalla es angosta (el menú es un cajón). Se actualiza al girar o redimensionar. */
export function useEsTelefono(): boolean {
  const [esTelefono, cambiar] = useState(
    () => typeof matchMedia === 'function' && matchMedia(CONSULTA_TELEFONO).matches,
  );
  useEffect(() => {
    if (typeof matchMedia !== 'function') return;
    const consulta = matchMedia(CONSULTA_TELEFONO);
    const alCambiar = () => cambiar(consulta.matches);
    consulta.addEventListener('change', alCambiar);
    return () => consulta.removeEventListener('change', alCambiar);
  }, []);
  return esTelefono;
}

export interface MenuMovil {
  abierto: boolean;
  /** El menú no se puede usar: es teléfono y el cajón está cerrado. */
  inerte: boolean;
  abrir: () => void;
  cerrar: () => void;
  /** Al elegir una sección (aunque sea la misma): cierra sin devolver el foco al botón. */
  alElegirSeccion: () => void;
}

/** `boton` abre y cierra el cajón; `menu` es el menú lateral. */
export function useMenuMovil(
  boton: RefObject<HTMLButtonElement | null>,
  menu: RefObject<HTMLElement | null>,
): MenuMovil {
  const esTelefono = useEsTelefono();
  // El cajón se abre para la ruta actual: elegir una sección (cambia la ruta) o pasar a pantalla
  // ancha lo da por cerrado sin mover el foco.
  const { pathname } = useLocation();
  const [abiertoEn, cambiarAbiertoEn] = useState<string | null>(null);
  const abierto = esTelefono && abiertoEn === pathname;

  const cerrar = useCallback(() => {
    cambiarAbiertoEn(null);
    boton.current?.focus();
  }, [boton]);
  const abrir = useCallback(() => cambiarAbiertoEn(pathname), [pathname]);
  const alElegirSeccion = useCallback(() => cambiarAbiertoEn(null), []);

  // Al abrir, el foco entra al menú (a la sección activa o a la primera).
  useEffect(() => {
    if (!abierto) return;
    const destino =
      menu.current?.querySelector<HTMLElement>('[aria-current="page"]') ??
      menu.current?.querySelector<HTMLElement>('a, button');
    destino?.focus();
  }, [abierto, menu]);

  // Escape cierra el cajón.
  useEffect(() => {
    if (!abierto) return;
    const alPresionar = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') cerrar();
    };
    document.addEventListener('keydown', alPresionar);
    return () => document.removeEventListener('keydown', alPresionar);
  }, [abierto, cerrar]);

  return {
    abierto,
    inerte: esTelefono && !abierto,
    abrir,
    cerrar,
    alElegirSeccion,
  };
}
