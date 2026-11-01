// Aviso que deja una página al navegar a otra, en el estado de la navegación: «Guardada como borrador.»
// al crear una pregunta (HU-12.3) o «Se importaron 12 preguntas como borrador.» al volver al banco
// después de importar (HU-13.2).
import { useLocation } from 'react-router';

/** El aviso que dejó la página anterior al navegar, si hay. */
export function useAvisoDeNavegacion(): string | null {
  const estado: unknown = useLocation().state;
  return typeof estado === 'object' && estado !== null && 'aviso' in estado
    ? String(estado.aviso)
    : null;
}
