// La mezcla de dificultad que el Generador pide a la IA, leída de la mezcla global de C09 (D1, RN-09):
// «30 % fácil, 45 % media y 25 % difícil». Mientras carga, o si falla la consulta, no hay texto.
import { useCallback } from 'react';
import { consultarListasOpciones } from '../servicios/temario';
import type { DificultadLista } from '../tipos/temario';
import { useCarga } from './carga';

const enLista = new Intl.ListFormat('es', { type: 'conjunction' });

/** «30 % fácil, 45 % media y 25 % difícil», con el objetivo de cada dificultad. */
export const textoDeMezcla = (dificultades: readonly DificultadLista[]): string | null =>
  dificultades.length === 0
    ? null
    : enLista.format(dificultades.map((d) => `${String(d.objetivo)} % ${d.nombre.toLowerCase()}`));

export function useMezclaPedida(): string | null {
  const carga = useCarga(useCallback((senal: AbortSignal) => consultarListasOpciones(senal), []));
  return carga.tipo === 'lista' ? textoDeMezcla(carga.datos.dificultades) : null;
}
