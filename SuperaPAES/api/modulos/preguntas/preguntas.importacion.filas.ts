// Revisión de cada fila de la importación (HU-13.1, CU-16 pasos 3 y 4): ubica la pregunta en el temario
// por los nombres de la prueba, el eje, el contenido y la habilidad, y revisa RN-08 con las reglas de
// preguntas.reglas.ts. Cada fila con problemas queda en el informe con todos sus motivos, en palabras
// del boceto C04 («No indica la alternativa correcta.»).
import type { PruebaTemario } from '../temario/index.js';
import { normalizar } from './preguntas.csv.js';
import {
  type Buscar,
  conEsquema,
  type ErrorDeFila,
  esMotivo,
  faltaONoExiste,
  MOTIVO_SOBRAN,
  resumir,
  type TextoDelArchivo,
} from './preguntas.importacion.comun.js';
import type { ColumnaPregunta, FilaDelArchivo } from './preguntas.plantilla.js';
import { faltaElTexto, problemasDeCantidad } from './preguntas.reglas.js';
import type { Opcion } from './preguntas.repositorio.js';
import {
  type AlternativaPregunta,
  type DatosPregunta,
  esquemaPregunta,
  LETRAS,
} from './preguntas.validadores.js';

/** Una pregunta válida. Su texto se nombra por el código: el id existe solo al crearlo. */
export interface PreguntaDelArchivo {
  fila: number;
  datos: DatosPregunta;
  codigoTexto: string | null;
}

/** Lo que se necesita para revisar las filas de preguntas. */
export interface ContextoDeFilas {
  buscar: Buscar;
  pruebas: readonly PruebaTemario[];
  dificultades: readonly Opcion[];
  /** Los textos del archivo de textos, por su código normalizado. */
  textos: ReadonlyMap<string, TextoDelArchivo>;
}

type Celdas = Record<ColumnaPregunta, string>;

const CANTIDADES = ['', 'una', 'dos', 'tres', 'cuatro', 'cinco'];
const COLUMNA_DE_LETRA = {
  A: 'alternativa_a',
  B: 'alternativa_b',
  C: 'alternativa_c',
  D: 'alternativa_d',
  E: 'alternativa_e',
} as const satisfies Record<(typeof LETRAS)[number], ColumnaPregunta>;

interface EnTemario {
  /** La prueba, si existe: con ella se revisan las alternativas y el texto aunque falte lo demás. */
  prueba: PruebaTemario | undefined;
  ids: { contenidoId: number; habilidadId: number; tipoPregunta: string } | null;
  motivos: string[];
}

/** La prueba, el contenido, la habilidad y el tipo de la fila, y por qué no están en el temario. */
function enTemario(c: Celdas, { buscar, pruebas }: ContextoDeFilas): EnTemario {
  const prueba = buscar(pruebas, c.prueba);
  if (!prueba) {
    const motivo = faltaONoExiste(
      c.prueba,
      'Falta la prueba.',
      `La prueba «${c.prueba}» no existe.`,
    );
    return { prueba, ids: null, motivos: [motivo] };
  }
  const eje = buscar(prueba.ejes, c.eje);
  const contenido = eje && buscar(eje.contenidos, c.contenido);
  const habilidad = buscar(prueba.habilidades, c.habilidad);
  const tipo = buscar(prueba.tiposPregunta, c.tipo);
  if (eje && contenido && habilidad && tipo) {
    const ids = { contenidoId: contenido.id, habilidadId: habilidad.id, tipoPregunta: tipo.codigo };
    return { prueba, ids, motivos: [] };
  }
  return {
    prueba,
    ids: null,
    motivos: motivosDelTemario(c, prueba, { eje, contenido, habilidad, tipo }),
  };
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
  // «B», «b», «A, C» o «A y C». Cualquier otra cosa («2», «BC») no es una letra.
  const marcadas = [
    ...new Set(
      valor
        .toUpperCase()
        .split(/[\s,;/]+/)
        .filter((marca) => marca && marca !== 'Y'),
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
function dificultadDe(valor: string, { buscar, dificultades }: ContextoDeFilas) {
  if (!valor) return { codigo: null };
  const dificultad = buscar(dificultades, valor);
  return dificultad
    ? { codigo: dificultad.codigo }
    : { motivo: `La dificultad «${valor}» no existe.` };
}

/**
 * Todo lo que tiene la fila, en el orden de sus columnas. Con la prueba encontrada se revisan las
 * alternativas y el texto aunque falte el eje o la habilidad: el informe trae todos los motivos de una
 * vez (CU-16 paso 4).
 */
function revisarFila(fila: FilaDelArchivo<ColumnaPregunta>, contexto: ContextoDeFilas) {
  const c = fila.celdas;
  const temario = enTemario(c, contexto);
  const { prueba } = temario;
  const { alternativas, motivos: deAlternativas } = alternativasDe(c);
  const dificultad = dificultadDe(c.dificultad_sugerida, contexto);
  const texto = prueba ? textoDe(c.codigo_texto, prueba, contexto.textos) : { codigo: null };
  const cantidad = prueba ? problemasDeCantidad(alternativas, prueba) : [];
  const motivos = [
    ...temario.motivos,
    ...motivosDeLosTextos(fila),
    ...deAlternativas,
    ...cantidad.map((problema) => problema.mensaje),
    ...[texto, dificultad].flatMap((parte) => ('motivo' in parte ? [parte.motivo] : [])),
  ];
  return { temario, alternativas, dificultad, texto, motivos };
}

/** La pregunta de la fila lista para crear, o la fila con todos sus motivos (CU-16 paso 4). */
export function leerPregunta(
  fila: FilaDelArchivo<ColumnaPregunta>,
  contexto: ContextoDeFilas,
): PreguntaDelArchivo | ErrorDeFila {
  const c = fila.celdas;
  const conError = (motivos: string[]): ErrorDeFila => ({
    archivo: 'preguntas',
    fila: fila.numero,
    resumen: resumir(c.enunciado),
    motivos,
  });
  const { temario, alternativas, dificultad, texto, motivos } = revisarFila(fila, contexto);
  const { prueba, ids } = temario;
  if (motivos.length > 0 || !prueba || !ids || 'motivo' in texto || 'motivo' in dificultad) {
    return conError(motivos);
  }
  const validada = conEsquema(esquemaPregunta, {
    pruebaId: prueba.id,
    ...ids,
    dificultadSugerida: dificultad.codigo,
    enunciado: c.enunciado,
    explicacion: c.explicacion,
    alternativas,
  });
  if ('motivos' in validada) return conError(validada.motivos);
  return { fila: fila.numero, codigoTexto: texto.codigo, datos: validada.datos };
}
