// Aviso que deja una página al navegar a otra, en el estado de la navegación: «Guardada como borrador.»
// al crear una pregunta (HU-12.3) o «Se importaron 12 preguntas como borrador.» al volver al banco
// después de importar (HU-13.2). Se muestra una sola vez: después se borra del historial, así no vuelve
// a aparecer al recargar la página o al volver a ella con «atrás».
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';

const avisoDe = (estado: unknown): string | null =>
  typeof estado === 'object' && estado !== null && 'aviso' in estado ? String(estado.aviso) : null;

/** El aviso que dejó la página anterior al navegar, si hay. */
export function useAvisoDeNavegacion(): string | null {
  const ubicacion = useLocation();
  const { pathname, search } = ubicacion;
  const state: unknown = ubicacion.state;
  const navegar = useNavigate();
  const [aviso] = useState(() => avisoDe(state));
  useEffect(() => {
    if (avisoDe(state) !== null)
      void navegar(`${pathname}${search}`, { replace: true, state: null });
  }, [navegar, pathname, search, state]);
  return aviso;
}
