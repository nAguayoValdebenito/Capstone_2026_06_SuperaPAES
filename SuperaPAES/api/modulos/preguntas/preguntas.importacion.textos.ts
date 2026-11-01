// Archivo de textos de lectura de la importación (HU-13.1, CU-16 alternativo 3.a): cada texto con su
// código, que nombran las preguntas de Competencia Lectora, y las filas con problemas.
import {
  conEsquema,
  crearBuscador,
  type ErrorDeFila,
  esMotivo,
  faltaONoExiste,
  MOTIVO_SOBRAN,
  resumir,
  type TextoDelArchivo,
} from './preguntas.importacion.comun.js';
import { normalizar } from './preguntas.csv.js';
import type { ColumnaTexto, FilaDelArchivo } from './preguntas.plantilla.js';
import type { Opcion } from './preguntas.repositorio.js';
import {
  esquemaTexto,
  LARGO_TITULO_TEXTO,
  TITULO_DEMASIADO_LARGO,
} from './preguntas.validadores.js';

/** Los motivos de una fila del archivo de textos. */
function motivosDelTexto(
  fila: FilaDelArchivo<ColumnaTexto>,
  tipo: Opcion | undefined,
  repetido: TextoDelArchivo | undefined,
): string[] {
  const c = fila.celdas;
  return [
    !c.codigo && 'Falta el código del texto.',
    repetido && `El código «${c.codigo}» ya está en la fila ${String(repetido.fila)}.`,
    !tipo &&
      faltaONoExiste(
        c.tipo_texto,
        'Falta el tipo de texto.',
        `El tipo de texto «${c.tipo_texto}» no existe.`,
      ),
    !c.titulo && 'Falta el título del texto.',
    c.titulo.length > LARGO_TITULO_TEXTO && TITULO_DEMASIADO_LARGO,
    !c.contenido && 'Falta el contenido del texto.',
    fila.sobran && MOTIVO_SOBRAN,
  ].filter(esMotivo);
}

/** CU-16 3.a: los textos del archivo de textos por su código, y las filas con problemas. */
export function leerTextos(
  filas: readonly FilaDelArchivo<ColumnaTexto>[],
  tipos: readonly Opcion[],
): { textos: Map<string, TextoDelArchivo>; errores: ErrorDeFila[] } {
  const textos = new Map<string, TextoDelArchivo>();
  const errores: ErrorDeFila[] = [];
  const buscar = crearBuscador();
  for (const fila of filas.filter((candidata) => !candidata.enBlanco)) {
    const c = fila.celdas;
    const clave = normalizar(c.codigo);
    const tipo = buscar(tipos, c.tipo_texto);
    const motivos = motivosDelTexto(fila, tipo, clave ? textos.get(clave) : undefined);
    const leido =
      motivos.length === 0 && tipo
        ? conEsquema(esquemaTexto, {
            tipoTexto: tipo.codigo,
            titulo: c.titulo,
            contenido: c.contenido,
          })
        : { motivos };
    const datos = 'datos' in leido ? leido.datos : null;
    if ('motivos' in leido) {
      const { motivos: todos } = leido;
      errores.push({
        archivo: 'textos',
        fila: fila.numero,
        resumen: resumir(c.titulo),
        motivos: todos,
      });
    }
    if (clave && !textos.has(clave))
      textos.set(clave, { fila: fila.numero, codigo: c.codigo, datos });
  }
  return { textos, errores };
}
