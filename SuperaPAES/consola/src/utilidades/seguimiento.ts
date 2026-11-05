// Textos de C06 · Revisiones: las pestañas, lo que hizo cada docente y el aviso de las áreas sin docentes.
import type { DocenteSeguido, GrupoSeguimiento, VistaSeguimiento } from '../tipos/seguimiento';

export const PESTANAS: readonly { grupo: GrupoSeguimiento; titulo: string }[] = [
  { grupo: 'en_curso', titulo: 'En curso' },
  { grupo: 'en_desempate', titulo: 'En desempate' },
  { grupo: 'vencidas', titulo: 'Vencidas' },
  { grupo: 'terminadas', titulo: 'Terminadas' },
];

const DECISIONES: Record<string, { texto: string; tono: string }> = {
  aprobar: { texto: 'Aprobó', tono: 'aprobada' },
  observar: { texto: 'Observó', tono: 'observada' },
  rechazar: { texto: 'Rechazó', tono: 'rechazada' },
};

/** Lo que muestra la etiqueta de un docente: su decisión y dificultad, o si sigue pendiente o venció. */
export function etiquetaDeDocente(
  { estado, decision, dificultad }: DocenteSeguido,
  vencida: boolean,
): { texto: string; tono: string } {
  const decidida = decision ? DECISIONES[decision] : undefined;
  if (decidida) {
    return { ...decidida, texto: [decidida.texto, dificultad].filter(Boolean).join(' · ') };
  }
  if (estado === 'vencida' || vencida) return { texto: 'Vencida', tono: 'observada' };
  return { texto: 'Pendiente', tono: 'en_revision' };
}

/** CU-18a: qué área no tiene docentes para revisar sus borradores. */
export function avisoSinDocentes({
  area,
  preguntas,
}: VistaSeguimiento['sinDocentes'][number]): string {
  const cuantas =
    preguntas === 1 ? '1 pregunta en borrador' : `${String(preguntas)} preguntas en borrador`;
  return `${area}: ${cuantas} sin docentes suficientes para revisarlas.`;
}
