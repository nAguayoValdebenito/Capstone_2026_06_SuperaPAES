// Lectura de los parámetros de la URL de una página (?prueba=2&pagina=3). Lo que no se entiende se
// ignora: la API valida el resto.

/** Un entero positivo de la URL, o undefined. */
export const entero = (texto: string | null) =>
  texto !== null && /^[1-9]\d{0,9}$/.test(texto) ? Number(texto) : undefined;
