// Un enunciado con fórmulas LaTeX ($2x + 3 = 11$) como texto legible para una lista, donde no se dibujan
// las fórmulas (el banco): sin los signos $, con los comandos más comunes en su símbolo. El editor y la
// vista previa sí dibujan la fórmula completa (KaTeX).

const SIMBOLOS: readonly [RegExp, string][] = [
  [/\\times/g, '×'],
  [/\\cdot/g, '·'],
  [/\\div/g, '÷'],
  [/\\pm/g, '±'],
  [/\\leq?/g, '≤'],
  [/\\geq?/g, '≥'],
  [/\\neq/g, '≠'],
  [/\\approx/g, '≈'],
  [/\\pi/g, 'π'],
  [/\\sqrt\{([^{}]*)\}/g, '√($1)'],
  [/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, '($1)/($2)'],
  [/\^\{?2\}?/g, '²'],
  [/\^\{?3\}?/g, '³'],
];

/** El texto sin los delimitadores de fórmula y con los símbolos LaTeX comunes como caracteres. */
export function textoPlano(texto: string): string {
  const sinSignos = texto.replaceAll('$$', '').replaceAll('$', '');
  return SIMBOLOS.reduce(
    (resultado, [patron, simbolo]) => resultado.replace(patron, simbolo),
    sinSignos,
  )
    .replaceAll(/[{}]/g, '')
    .replaceAll(/\s+/g, ' ')
    .trim();
}
