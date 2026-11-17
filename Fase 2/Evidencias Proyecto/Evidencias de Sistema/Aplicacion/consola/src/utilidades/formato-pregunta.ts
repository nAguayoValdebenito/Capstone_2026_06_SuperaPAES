// Formato de las preguntas (HU-12.4, igual que la app en HU-34.2): el enunciado, las alternativas, la
// explicación y el texto de lectura vienen en Markdown, con las fórmulas en LaTeX entre signos `$` y
// las imágenes como `![texto alternativo](url)`. Mismas reglas que app/lib/presentacion/comunes/
// formato_pregunta.dart, para que la vista previa de C03 separe el texto como lo verá el estudiante.

/** Un trozo de un párrafo: texto (en negrita o cursiva) o una fórmula en línea. */
export type TrozoPregunta =
  | { tipo: 'texto'; texto: string; negrita: boolean; cursiva: boolean }
  | { tipo: 'formula'; tex: string };

/** Un bloque de la pregunta: un párrafo, una fórmula sola (`$$…$$`) o una imagen. */
export type BloquePregunta =
  | { tipo: 'parrafo'; trozos: TrozoPregunta[] }
  | { tipo: 'formula'; tex: string }
  | { tipo: 'imagen'; url: string; alternativo: string };

const FORMULA_EN_BLOQUE = /\$\$([\s\S]+?)\$\$/g;
const IMAGEN = /!\[([^\]]*)\]\(([^)\s]+)\)/g;

/**
 * Separa el texto en bloques: primero las fórmulas `$$…$$`, que pueden ocupar varias líneas; después
 * los párrafos (separados por una línea vacía) y, dentro de ellos, las imágenes.
 */
export function bloquesDePregunta(texto: string): BloquePregunta[] {
  const bloques: BloquePregunta[] = [];
  let desde = 0;
  for (const formula of texto.matchAll(FORMULA_EN_BLOQUE)) {
    bloques.push(...bloquesDeTexto(texto.slice(desde, formula.index)), {
      tipo: 'formula',
      tex: (formula[1] ?? '').trim(),
    });
    desde = formula.index + formula[0].length;
  }
  bloques.push(...bloquesDeTexto(texto.slice(desde)));
  return bloques;
}

function bloquesDeTexto(texto: string): BloquePregunta[] {
  return texto.split(/\n\s*\n/).flatMap((parrafo) => bloquesDeParrafo(parrafo.trim()));
}

function bloquesDeParrafo(parrafo: string): BloquePregunta[] {
  const bloques: BloquePregunta[] = [];
  const agregarTexto = (parte: string) => {
    const limpio = parte.trim();
    if (limpio) bloques.push({ tipo: 'parrafo', trozos: trozosDeTexto(limpio) });
  };
  let desde = 0;
  for (const imagen of parrafo.matchAll(IMAGEN)) {
    agregarTexto(parrafo.slice(desde, imagen.index));
    bloques.push({ tipo: 'imagen', url: imagen[2] ?? '', alternativo: imagen[1] ?? '' });
    desde = imagen.index + imagen[0].length;
  }
  agregarTexto(parrafo.slice(desde));
  return bloques;
}

/** Estado mientras se recorre un párrafo letra a letra. */
interface Lectura {
  texto: string;
  i: number;
  actual: string;
  negrita: boolean;
  cursiva: boolean;
  trozos: TrozoPregunta[];
}

const esEspacio = (letra: string | undefined) => letra === undefined || letra.trim() === '';

function cerrarTexto(l: Lectura) {
  if (!l.actual) return;
  l.trozos.push({ tipo: 'texto', texto: l.actual, negrita: l.negrita, cursiva: l.cursiva });
  l.actual = '';
}

/** Posición del `$` que cierra la fórmula abierta en `desde - 1`, o null si no se cierra. */
function cierreDeFormula(texto: string, desde: number): number | null {
  for (let j = desde; j < texto.length; j++) {
    if (texto[j] !== '$' || texto[j - 1] === '\\') continue;
    if (!esEspacio(texto[j - 1]) && !/\d/.test(texto[j + 1] ?? '')) return j;
  }
  return null;
}

/** Lee la fórmula que abre el `$` actual; false si no se cierra y el `$` queda como texto. */
function leerFormula(l: Lectura): boolean {
  if (esEspacio(l.texto[l.i + 1])) return false;
  const cierre = cierreDeFormula(l.texto, l.i + 1);
  if (cierre === null) return false;
  cerrarTexto(l);
  l.trozos.push({ tipo: 'formula', tex: l.texto.slice(l.i + 1, cierre) });
  l.i = cierre + 1;
  return true;
}

/** Un `*` abre la cursiva si lo sigue algo que no es un espacio y la cierra si lo antecede algo. */
function cambiaCursiva(l: Lectura): boolean {
  return l.cursiva ? !esEspacio(l.texto[l.i - 1]) : !esEspacio(l.texto[l.i + 1]);
}

function cambiarEstilo(l: Lectura, estilo: 'negrita' | 'cursiva', largo: number) {
  cerrarTexto(l);
  l[estilo] = !l[estilo];
  l.i += largo;
}

function leerLetra(l: Lectura) {
  const letra = l.texto[l.i] ?? '';
  const siguiente = l.texto[l.i + 1];
  if (letra === '\\' && siguiente === '$') {
    l.actual += '$';
    l.i += 2;
  } else if (letra === '$' && leerFormula(l)) {
    return;
  } else if (letra === '*' && siguiente === '*') {
    cambiarEstilo(l, 'negrita', 2);
  } else if (letra === '*' && cambiaCursiva(l)) {
    cambiarEstilo(l, 'cursiva', 1);
  } else {
    l.actual += letra;
    l.i += 1;
  }
}

/**
 * Separa un párrafo en texto y fórmulas `$…$`, con `**negrita**` y `*cursiva*`. Como en Pandoc, un `$`
 * abre una fórmula solo si lo sigue algo que no es un espacio, y la cierra un `$` que tiene algo antes
 * y no lo sigue un dígito: así «$5.000 y $3.000» queda como texto. `\$` es un signo peso.
 */
export function trozosDeTexto(texto: string): TrozoPregunta[] {
  const l: Lectura = { texto, i: 0, actual: '', negrita: false, cursiva: false, trozos: [] };
  while (l.i < texto.length) leerLetra(l);
  cerrarTexto(l);
  return l.trozos;
}

/** Las fórmulas de un texto, en línea y solas, en el orden en que aparecen. */
export function formulasDe(texto: string): string[] {
  return bloquesDePregunta(texto).flatMap((bloque) => {
    if (bloque.tipo === 'formula') return [bloque.tex];
    if (bloque.tipo === 'imagen') return [];
    return bloque.trozos.flatMap((trozo) => (trozo.tipo === 'formula' ? [trozo.tex] : []));
  });
}
