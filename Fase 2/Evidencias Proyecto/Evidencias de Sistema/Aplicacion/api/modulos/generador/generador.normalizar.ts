// Comparación de textos para detectar repetidas (HU-17.2). El DAS pide comparar «sin contar mayúsculas,
// tildes, espacios ni signos de puntuación». En matemática los operadores (+, -, =), los paréntesis y la
// coma o el punto entre dígitos cambian el sentido, así que solo se quita la puntuación del texto corrido:
// comillas, signos de interrogación y exclamación, y punto, coma, punto y coma o dos puntos que no van entre dígitos.

const MARCAS_COMBINANTES = /\p{M}/gu;
const SIGNOS_Y_COMILLAS = /[¿?¡!"'«»“”‘’…]/gu;
const PUNTUACION_FUERA_DE_NUMEROS = /(?<!\d)[.,;:]|[.,;:](?!\d)/gu;
const ESPACIOS = /\s+/gu;

export function normalizarParaComparar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(MARCAS_COMBINANTES, '')
    .toLowerCase()
    .replace(SIGNOS_Y_COMILLAS, '')
    .replace(PUNTUACION_FUERA_DE_NUMEROS, '')
    .replace(ESPACIOS, '');
}
