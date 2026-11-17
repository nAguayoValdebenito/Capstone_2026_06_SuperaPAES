// Comparación de texto sin distinguir mayúsculas ni tildes (búsqueda global, Ctrl K).

/** El texto en minúsculas y sin tildes: «Configuración» → «configuracion». */
export const sinTildes = (texto: string): string =>
  texto
    .normalize('NFD')
    .replaceAll(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();

/** Si el texto contiene la búsqueda, sin distinguir mayúsculas ni tildes. */
export const contiene = (texto: string, busqueda: string): boolean =>
  sinTildes(texto).includes(sinTildes(busqueda));
