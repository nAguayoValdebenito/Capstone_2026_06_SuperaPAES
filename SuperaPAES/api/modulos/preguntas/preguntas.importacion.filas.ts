// Revisión de cada fila de la importación (HU-13.1, CU-16 pasos 3 y 4): ubica la pregunta en el temario
// por los nombres de la prueba, el eje, el contenido y la habilidad, y revisa RN-08 con las reglas de
// preguntas.reglas.ts. Cada fila con problemas queda en el informe con todos sus motivos, en palabras
// del boceto C04 («No indica la alternativa correcta.»).
import type { PruebaTemario } from '../temario/index.js';
import { normalizar } from './preguntas.csv.js';
import type { ColumnaPregunta, ColumnaTexto, FilaDelArchivo } from './preguntas.plantilla.js';
import { faltaElTexto, problemasDeCantidad } from './preguntas.reglas.js';
import type { Opcion } from './preguntas.repositorio.js';
import {
  type AlternativaPregunta,
  type DatosPregunta,
  type DatosTexto,
  LETRAS,
} from './preguntas.validadores.js';

/** Una fila que no se importa, con sus motivos (la tabla «Filas con errores» de C04). */
export interface ErrorDeFila {
  archivo: 'preguntas' | 'textos';
  fila: number;
  /** Comienzo del enunciado o el título del texto, para reconocer la fila. */
  resumen: string;
  motivos: string[];
}

/** Una pregunta válida. Su texto se nombra por el código: el id existe solo al crearlo. */
export interface PreguntaDelArchivo {
  fila: number;
  datos: DatosPregunta;
  codigoTexto: string | null;
}

/** Un texto del archivo de textos; sin datos si su fila tiene errores. */
export interface TextoDelArchivo {
  fila: number;
  codigo: string;
  datos: DatosTexto | null;
}

/** Lo que se necesita para revisar las filas de preguntas. */
export interface ContextoDeFilas {
  pruebas: readonly PruebaTemario[];
  dificultades: readonly Opcion[];
  /** Los textos del archivo de textos, por su código normalizado. */
  textos: ReadonlyMap<string, TextoDelArchivo>;
}

type Celdas = Record<ColumnaPregunta, string>;

const LARGO_RESUMEN = 80;
const LARGO_TITULO = 200;
const CANTIDADES = ['', 'una', 'dos', 'tres', 'cuatro', 'cinco'];
const COLUMNA_DE_LETRA = {
  A: 'alternativa_a',
  B: 'alternativa_b',
  C: 'alternativa_c',
  D: 'alternativa_d',
  E: 'alternativa_e',
} as const satisfies Record<(typeof LETRAS)[number], ColumnaPregunta>;

const MOTIVO_SOBRAN =
  'Tiene más celdas que columnas: revisa las comillas de los textos con «;» o «,».';

/** Los motivos de una lista armada con condiciones: quedan los textos no vacíos. */
const esMotivo = (motivo: unknown): motivo is string => typeof motivo === 'string' && motivo !== '';

function resumir(texto: string): string {
  const limpio = texto.replace(/\s+/g, ' ').trim();
  return limpio.length > LARGO_RESUMEN ? `${limpio.slice(0, LARGO_RESUMEN - 1)}…` : limpio;
}

/** La opción que se llama como `valor` o tiene ese código, sin mirar tildes ni mayúsculas. */
function buscar<T extends { nombre: string; codigo?: string }>(
  lista: readonly T[],
  valor: string,
): T | undefined {
  const buscado = normalizar(valor);
  if (!buscado) return undefined;
  return lista.find(
    (opcion) =>
      normalizar(opcion.nombre) === buscado ||
      (opcion.codigo !== undefined && normalizar(opcion.codigo) === buscado),
  );
}

/** «Falta el eje.» si la celda está vacía, o que el valor no existe. */
const faltaONoExiste = (valor: string, falta: string, noExiste: string) =>
  valor ? noExiste : falta;

interface Ubicacion {
  prueba: PruebaTemario;
  contenidoId: number;
  habilidadId: number;
  tipoPregunta: string;
}

/** La prueba, el contenido, la habilidad y el tipo de la fila, o por qué no están en el temario. */
function enTemario(c: Celdas, pruebas: readonly PruebaTemario[]): Ubicacion | string[] {
  const prueba = buscar(pruebas, c.prueba);
  if (!prueba)
    return [faltaONoExiste(c.prueba, 'Falta la prueba.', `La prueba «${c.prueba}» no existe.`)];
  const eje = buscar(prueba.ejes, c.eje);
  const contenido = eje && buscar(eje.contenidos, c.contenido);
  const habilidad = buscar(prueba.habilidades, c.habilidad);
  const tipo = buscar(prueba.tiposPregunta, c.tipo);
  if (eje && contenido && habilidad && tipo) {
    return {
      prueba,
      contenidoId: contenido.id,
      habilidadId: habilidad.id,
      tipoPregunta: tipo.codigo,
    };
  }
  return motivosDelTemario(c, prueba, { eje, contenido, habilidad, tipo });
}

/** Por qué el eje, el contenido, la habilidad o el tipo de la fila no están en la prueba. */
function motivosDelTemario(
  c: Celdas,
  prueba: PruebaTemario,
  encontrados: {
    eje: PruebaTemario['ejes'][number] | undefined;
    contenido: unknown;
    habilidad: unknown;
    tipo: unknown;
  },
): string[] {
  const { eje } = encontrados;
  const deLaPrueba = `en el temario de ${prueba.nombre}`;
  return [
    !eje && faltaONoExiste(c.eje, 'Falta el eje.', `El eje «${c.eje}» no existe ${deLaPrueba}.`),
    eje &&
      !encontrados.contenido &&
      faltaONoExiste(
        c.contenido,
        'Falta el contenido.',
        `El contenido «${c.contenido}» no existe en el eje ${eje.nombre}.`,
      ),
    !encontrados.habilidad &&
      faltaONoExiste(
        c.habilidad,
        'Falta la habilidad.',
        `La habilidad «${c.habilidad}» no existe ${deLaPrueba}.`,
      ),
    !encontrados.tipo &&
      faltaONoExiste(
        c.tipo,
        'Falta el tipo de pregunta.',
        `${prueba.nombre} no admite el tipo «${c.tipo}».`,
      ),
  ].filter(esMotivo);
}

/** La letra de la columna «correcta», o por qué no sirve; `cuantas` son las alternativas escritas. */
function correctaDe(valor: string, cuantas: number): { letra: string } | { motivo: string } {
  const marcadas = [
    ...new Set(
      valor
        .toUpperCase()
        .split(/[^A-Z]+/)
        .filter(Boolean),
    ),
  ];
  if (marcadas.length === 0) return { motivo: 'No indica la alternativa correcta.' };
  if (marcadas.some((marca) => !(LETRAS as readonly string[]).includes(marca))) {
    return { motivo: `La correcta «${valor}» no es una letra de la A a la E.` };
  }
  if (marcadas.length > 1) {
    return { motivo: `Marca ${CANTIDADES[marcadas.length] ?? ''} alternativas como correctas.` };
  }
  const letra = marcadas[0] ?? '';
  // Una alternativa vacía antes de la última escrita ya tiene su motivo («Falta el texto…»).
  return LETRAS.indexOf(letra as (typeof LETRAS)[number]) < cuantas
    ? { letra }
    : { motivo: `La alternativa correcta (${letra}) no tiene texto.` };
}

/** Las alternativas de la A hasta la última escrita, con la correcta marcada. */
function alternativasDe(c: Celdas): { alternativas: AlternativaPregunta[]; motivos: string[] } {
  const textos = LETRAS.map((letra) => c[COLUMNA_DE_LETRA[letra]]);
  const letras = LETRAS.slice(0, textos.findLastIndex(Boolean) + 1);
  const motivos = letras
    .filter((_letra, i) => !textos[i])
    .map((letra) => `Falta el texto de la alternativa ${letra}.`);
  const correcta = correctaDe(c.correcta, letras.length);
  if ('motivo' in correcta) motivos.push(correcta.motivo);
  const alternativas = letras.map((letra, i) => ({
    letra,
    texto: textos[i] ?? '',
    esCorrecta: 'letra' in correcta && correcta.letra === letra,
    explicacion: null,
  }));
  return { alternativas, motivos };
}

/** Enunciado, explicación, imagen y celdas de más. */
function motivosDeLosTextos(fila: FilaDelArchivo<ColumnaPregunta>): string[] {
  const c = fila.celdas;
  return [
    !c.enunciado && 'Falta el enunciado.',
    !c.explicacion && 'Falta la explicación de la respuesta correcta.',
    // Las imágenes del .zip no se importan todavía: el modelo no tiene dónde guardarlas.
    c.imagen && `La imagen ${c.imagen} no se puede importar todavía: deja vacía la columna imagen.`,
    fila.sobran && MOTIVO_SOBRAN,
  ].filter(esMotivo);
}

/** El código del texto de la fila, o por qué falta o no sirve. */
function textoDe(
  codigo: string,
  prueba: PruebaTemario,
  textos: ContextoDeFilas['textos'],
): { codigo: string | null } | { motivo: string } {
  if (!codigo)
    return prueba.requiereTexto ? { motivo: faltaElTexto(prueba).mensaje } : { codigo: null };
  const texto = textos.get(normalizar(codigo));
  if (!texto) return { motivo: `El texto «${codigo}» no viene en el archivo de textos.` };
  if (!texto.datos) {
    return {
      motivo: `El texto «${codigo}» tiene errores (archivo de textos, fila ${String(texto.fila)}).`,
    };
  }
  return { codigo: normalizar(codigo) };
}

/** RN-12: la dificultad del archivo es solo una sugerencia, y es opcional. */
function dificultadDe(valor: string, dificultades: readonly Opcion[]) {
  if (!valor) return { codigo: null };
  const dificultad = buscar(dificultades, valor);
  return dificultad
    ? { codigo: dificultad.codigo }
    : { motivo: `La dificultad «${valor}» no existe.` };
}

/** La pregunta de la fila lista para crear, o la fila con todos sus motivos (CU-16 paso 4). */
export function leerPregunta(
  fila: FilaDelArchivo<ColumnaPregunta>,
  { pruebas, dificultades, textos }: ContextoDeFilas,
): PreguntaDelArchivo | ErrorDeFila {
  const c = fila.celdas;
  const conError = (motivos: string[]): ErrorDeFila => ({
    archivo: 'preguntas',
    fila: fila.numero,
    resumen: resumir(c.enunciado),
    motivos,
  });
  const ubicacion = enTemario(c, pruebas);
  const { alternativas, motivos: deAlternativas } = alternativasDe(c);
  const motivos = [...motivosDeLosTextos(fila), ...deAlternativas];
  const dificultad = dificultadDe(c.dificultad_sugerida, dificultades);
  if ('motivo' in dificultad) motivos.push(dificultad.motivo);
  if (Array.isArray(ubicacion)) return conError([...ubicacion, ...motivos]);
  const { prueba, ...ids } = ubicacion;
  motivos.push(...problemasDeCantidad(alternativas, prueba).map((problema) => problema.mensaje));
  const texto = textoDe(c.codigo_texto, prueba, textos);
  if ('motivo' in texto) motivos.push(texto.motivo);
  if (motivos.length > 0 || 'motivo' in texto || 'motivo' in dificultad) return conError(motivos);
  return {
    fila: fila.numero,
    codigoTexto: texto.codigo,
    datos: {
      pruebaId: prueba.id,
      ...ids,
      dificultadSugerida: dificultad.codigo,
      enunciado: c.enunciado,
      explicacion: c.explicacion,
      textoEstimuloId: null,
      textoNuevo: null,
      ordenEnTexto: null,
      alternativas,
    },
  };
}

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
    c.titulo.length > LARGO_TITULO && 'El título puede tener hasta 200 caracteres.',
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
  for (const fila of filas.filter((candidata) => !candidata.enBlanco)) {
    const c = fila.celdas;
    const clave = normalizar(c.codigo);
    const tipo = buscar(tipos, c.tipo_texto);
    const motivos = motivosDelTexto(fila, tipo, clave ? textos.get(clave) : undefined);
    const datos =
      motivos.length === 0 && tipo
        ? { tipoTexto: tipo.codigo, titulo: c.titulo, contenido: c.contenido, imagenUrl: null }
        : null;
    if (!datos)
      errores.push({ archivo: 'textos', fila: fila.numero, resumen: resumir(c.titulo), motivos });
    if (clave && !textos.has(clave))
      textos.set(clave, { fila: fila.numero, codigo: c.codigo, datos });
  }
  return { textos, errores };
}
