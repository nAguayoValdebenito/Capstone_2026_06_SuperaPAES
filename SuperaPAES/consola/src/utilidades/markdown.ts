// Lectura del Markdown de los textos legales (contenido.documento_legal, RN-30): solo lo que usan, que
// es el título (#), los subtítulos (##), los párrafos y las listas con guion. Mismas reglas que
// app/lib/presentacion/comunes/texto_documento.dart (A02 y A02b), así la consola y la app los muestran
// igual. Devuelve bloques que la página dibuja con React, sin insertar HTML; cualquier otra marca se
// muestra como texto. Cada elemento de lista va en una sola línea: una línea siguiente sin guion es un
// párrafo aparte, también en la app.

export type BloqueTexto =
  { tipo: 'titulo' | 'subtitulo' | 'parrafo'; texto: string } | { tipo: 'lista'; items: string[] };

const ENCABEZADO = /^(##?) (.*)$/;
const LISTA = /^- (.*)$/;

/** El bloque que empieza una línea que no es de un párrafo: un encabezado o un elemento de lista. */
function bloqueDeLinea(texto: string): BloqueTexto | null {
  const encabezado = ENCABEZADO.exec(texto);
  if (encabezado) {
    const tipo = encabezado[1] === '#' ? 'titulo' : 'subtitulo';
    return { tipo, texto: encabezado[2] ?? '' };
  }
  const item = LISTA.exec(texto);
  return item ? { tipo: 'lista', items: [item[1] ?? ''] } : null;
}

/** Los bloques del texto: los párrafos terminan en una línea en blanco, un encabezado o una lista. */
export function bloquesDe(markdown: string): BloqueTexto[] {
  const bloques: BloqueTexto[] = [];
  let parrafo: string[] = [];
  const cerrarParrafo = () => {
    if (parrafo.length > 0) bloques.push({ tipo: 'parrafo', texto: parrafo.join(' ') });
    parrafo = [];
  };
  for (const linea of markdown.split(/\r?\n/)) {
    const texto = linea.trim();
    const bloque = bloqueDeLinea(texto);
    if (texto !== '' && !bloque) {
      parrafo.push(texto);
      continue;
    }
    cerrarParrafo();
    const ultimo = bloques.at(-1);
    if (bloque?.tipo === 'lista' && ultimo?.tipo === 'lista') ultimo.items.push(...bloque.items);
    else if (bloque) bloques.push(bloque);
  }
  cerrarParrafo();
  return bloques;
}
