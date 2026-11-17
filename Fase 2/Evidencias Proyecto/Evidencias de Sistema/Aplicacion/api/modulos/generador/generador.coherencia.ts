// Coherencia entre el cálculo de la IA («resolucion») y la alternativa que marcó como correcta (HU-17.1).
// Es una comprobación barata, no una demostración: solo compara números racionales (enteros, decimales y
// fracciones) y descarta únicamente ante una discrepancia clara. Lo que no se puede leer como número
// (expresiones algebraicas, intervalos, conjuntos, respuestas en texto o con unidades) queda «no_comprobable»
// y pasa a los docentes. Los separadores siguen el uso chileno: coma decimal y punto de miles (1.250).

export type Coherencia = 'coherente' | 'incoherente' | 'no_comprobable';

interface Racional {
  n: bigint;
  d: bigint;
}

const NUMERO = String.raw`\d+(?:[.,]\d+)?`;
const VALOR = String.raw`-?\s*${NUMERO}(?:\s*/\s*${NUMERO})?`;
const VALOR_COMPLETO = new RegExp(`^${VALOR}$`, 'u');
// El número no puede seguir con más dígitos ni con «,5» o «.5» (parte decimal); una coma o un punto de
// oración sí lo cierran.
const VALOR_INICIAL = new RegExp(`^\\s*(${VALOR})(?!\\d|[.,]\\d)`, 'u');
const FRACCION_LATEX = new RegExp(
  String.raw`\\[dt]?frac\s*\{\s*(-?${NUMERO})\s*\}\s*\{\s*(${NUMERO})\s*\}`,
  'gu',
);

/** Quita decoración de LaTeX y de texto que no cambia el valor; las fracciones simples pasan a «a/b». */
function limpiar(texto: string): string {
  return texto
    .replace(/−/gu, '-')
    .replace(/\{,\}/gu, ',')
    .replace(FRACCION_LATEX, '$1/$2')
    .replace(/\\(?:left|right|,|;|!|:|%)/gu, '')
    .replace(/\\text\{[^}]*\}/gu, ' ')
    .replace(/[$]|\\[()[\]]/gu, '')
    .replace(/\\ /gu, ' ')
    .replace(/%/gu, '')
    .replace(/\s+/gu, ' ')
    .trim();
}

function enteroDe(digitos: string): bigint {
  return BigInt(digitos);
}

/** «1.250» es mil doscientos cincuenta; «0,25» y «0.25» son un cuarto. */
function numeroDe(token: string): Racional | null {
  if (/^\d{1,3}(?:\.\d{3})+$/u.test(token))
    return { n: enteroDe(token.replaceAll('.', '')), d: 1n };
  const [entera = '', decimal = ''] = token.replace(',', '.').split('.');
  return { n: enteroDe(`${entera}${decimal}`), d: 10n ** BigInt(decimal.length) };
}

function valorDe(texto: string): Racional | null {
  const compacto = texto.replace(/\s+/gu, '');
  const negativo = compacto.startsWith('-');
  const [arriba = '', abajo] = (negativo ? compacto.slice(1) : compacto).split('/');
  const numerador = numeroDe(arriba);
  const denominador = abajo === undefined ? { n: 1n, d: 1n } : numeroDe(abajo);
  if (numerador === null || denominador === null || denominador.n === 0n) return null;
  const n = numerador.n * denominador.d;
  return { n: negativo ? -n : n, d: numerador.d * denominador.n };
}

const iguales = (a: Racional, b: Racional): boolean => a.n * b.d === b.n * a.d;

/** El valor de la alternativa si es solo un número («x = 8» vale 8); si no, null. */
function valorDeLaClave(clave: string): Racional | null {
  const limpia = limpiar(clave);
  const despuesDelIgual = limpia.includes('=') ? limpia.slice(limpia.lastIndexOf('=') + 1) : limpia;
  const solo = despuesDelIgual.trim().replace(/[.;]$/u, '');
  return VALOR_COMPLETO.test(solo) ? valorDe(solo) : null;
}

/**
 * Los números que siguen a cada «=» del cálculo. Un número seguido de un operador, un exponente o una
 * letra pegada («2 \cdot 7», «3x») es parte de una expresión, no un resultado.
 */
function resultadosDelCalculo(resolucion: string): Racional[] {
  const limpio = limpiar(resolucion);
  const resultados: Racional[] = [];
  for (const tramo of limpio.split('=').slice(1)) {
    const coincidencia = VALOR_INICIAL.exec(tramo);
    if (coincidencia?.[1] === undefined) continue;
    const resto = tramo.slice(coincidencia[0].length).trimStart();
    const sigueExpresion =
      /^[+\-*/^_\\(]/u.test(resto) || /^[a-zA-Z]/u.test(tramo.slice(coincidencia[0].length));
    const valor = sigueExpresion ? null : valorDe(coincidencia[1]);
    if (valor !== null) resultados.push(valor);
  }
  return resultados;
}

/**
 * ¿La alternativa correcta coincide con el resultado del cálculo? Se miran los dos últimos resultados del
 * cálculo, porque a veces termina con una comprobación («... = 17»).
 */
export function compararClave(resolucion: string, textoClave: string): Coherencia {
  const clave = valorDeLaClave(textoClave);
  const resultados = resultadosDelCalculo(resolucion).slice(-2);
  if (clave === null || resultados.length === 0) return 'no_comprobable';
  return resultados.some((resultado) => iguales(resultado, clave)) ? 'coherente' : 'incoherente';
}
