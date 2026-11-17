// Lectura de respuestas en la terminal para los comandos de una sola vez (por ejemplo, crear-admin).
// La contraseña se escribe sin que se vea: la terminal pasa a modo crudo y no se repite lo tecleado.

/** Lo que se usa de process.stdin; en las pruebas se reemplaza por un falso. */
export interface EntradaTerminal {
  isTTY?: boolean;
  setRawMode?(modo: boolean): unknown;
  setEncoding(codificacion: BufferEncoding): unknown;
  resume(): unknown;
  pause(): unknown;
  on(evento: 'data', escucha: (trozo: string) => void): unknown;
  off(evento: 'data', escucha: (trozo: string) => void): unknown;
}

export interface SalidaTerminal {
  write(texto: string): unknown;
}

export class ErrorTerminal extends Error {
  override name = 'ErrorTerminal';
}

const ENTER = new Set(['\r', '\n']);
const BORRAR = new Set(['\u007f', '\b']);
const CTRL_C = '\u0003';

interface Lectura {
  texto: string;
  /** true al terminar con Enter; false si se canceló con Ctrl+C. */
  fin?: boolean;
}

/** Aplica un carácter a lo leído. Devuelve lo que hay que mostrar en la terminal. */
function aplicar(lectura: Lectura, caracter: string, oculta: boolean): string {
  if (ENTER.has(caracter)) {
    lectura.fin = true;
    return '\n';
  }
  if (caracter === CTRL_C) {
    lectura.fin = false;
    return '\n';
  }
  if (BORRAR.has(caracter)) {
    const antes = lectura.texto;
    lectura.texto = [...antes].slice(0, -1).join('');
    return antes === lectura.texto || oculta ? '' : '\b \b';
  }
  lectura.texto += caracter;
  return oculta ? '' : caracter;
}

/**
 * Hace una pregunta y lee una línea. Con `oculta`, lo que se escribe no aparece en la pantalla.
 * Exige una terminal interactiva: así la contraseña nunca llega por un archivo ni por el historial.
 */
export function preguntar(
  entrada: EntradaTerminal,
  salida: SalidaTerminal,
  pregunta: string,
  oculta = false,
): Promise<string> {
  if (!entrada.isTTY || !entrada.setRawMode) {
    return Promise.reject(
      new ErrorTerminal(
        'Ejecuta el comando en una terminal interactiva (PowerShell o la de VS Code).',
      ),
    );
  }
  const setRawMode = entrada.setRawMode.bind(entrada);
  salida.write(pregunta);
  setRawMode(true);
  entrada.setEncoding('utf8');
  entrada.resume();
  return new Promise((resolver, rechazar) => {
    const lectura: Lectura = { texto: '' };
    const alLeer = (trozo: string) => {
      for (const caracter of trozo) {
        salida.write(aplicar(lectura, caracter, oculta));
        if (lectura.fin !== undefined) break;
      }
      if (lectura.fin === undefined) return;
      entrada.off('data', alLeer);
      setRawMode(false);
      entrada.pause();
      if (lectura.fin) resolver(lectura.texto.trim() === '' ? '' : lectura.texto);
      else rechazar(new ErrorTerminal('Cancelado.'));
    };
    entrada.on('data', alLeer);
  });
}
