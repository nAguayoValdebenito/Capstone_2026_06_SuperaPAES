// Fórmulas LaTeX dibujadas con KaTeX (HU-12.4), el mismo motor que usa la app (flutter_math_fork).
// KaTeX escapa el texto que recibe y no permite enlaces, imágenes ni HTML dentro de una fórmula: su
// HTML es lo único que la vista previa inserta sin pasar por React.
import katex from 'katex';

export type FormulaDibujada = { html: string } | { error: string };

const OPCIONES = {
  throwOnError: true,
  // \href, \url, \includegraphics y \html… nunca se permiten. En vez de dibujarlos en rojo, la fórmula
  // queda con error para que la vista previa avise (la app tampoco los dibuja).
  trust: ({ command }: { command: string }) => {
    throw new Error(`${command} no está permitido en una fórmula.`);
  },
  strict: 'ignore',
  // Límites ante una fórmula que se expande sin fin o pide un tamaño enorme.
  maxExpand: 200,
  maxSize: 20,
} as const;

// Se dibuja una vez por fórmula: la vista previa vuelve a pintar todo en cada tecla.
const dibujadas = new Map<string, FormulaDibujada>();
const MAXIMO_EN_MEMORIA = 300;

function dibujar(tex: string, enBloque: boolean): FormulaDibujada {
  try {
    return { html: katex.renderToString(tex, { ...OPCIONES, displayMode: enBloque }) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

/** El HTML de la fórmula, o su error si KaTeX no la puede leer. */
export function dibujarFormula(tex: string, enBloque = false): FormulaDibujada {
  const clave = `${enBloque ? 'B' : 'L'}${tex}`;
  const guardada = dibujadas.get(clave);
  if (guardada) return guardada;
  if (dibujadas.size >= MAXIMO_EN_MEMORIA) dibujadas.clear();
  const dibujada = dibujar(tex, enBloque);
  dibujadas.set(clave, dibujada);
  return dibujada;
}
