// Reglas del formulario de crear o editar una pregunta (C03, HU-12.3): temario encadenado, cantidad de
// alternativas según la prueba (RN-08), una sola correcta, texto de lectura en Competencia Lectora y
// validación previa con los mismos mensajes que la API, que vuelve a validar todo.
import { ErrorApi } from '../api/cliente';
import {
  type DatosPregunta,
  type DatosTexto,
  type Letra,
  LETRAS,
  type PreguntaParaEditar,
  type PruebaTemario,
} from '../tipos';
import { mensajeDeError } from './usuarios-internos';

export interface CamposAlternativa {
  letra: Letra;
  texto: string;
  explicacion: string;
}

/** Texto de lectura: uno guardado (por su id) o uno nuevo, con el orden de la pregunta en él. */
export interface CamposTexto {
  modo: 'guardado' | 'nuevo';
  id: number | undefined;
  nuevo: { tipoTexto: string; titulo: string; contenido: string; imagenUrl: string };
  orden: string;
}

export interface CamposPregunta {
  pruebaId: number | undefined;
  ejeId: number | undefined;
  contenidoId: number | undefined;
  habilidadId: number | undefined;
  tipoPregunta: string;
  /** Código de la dificultad sugerida; vacío si no se sugiere. */
  dificultadSugerida: string;
  enunciado: string;
  explicacion: string;
  alternativas: CamposAlternativa[];
  correcta: Letra | undefined;
  texto: CamposTexto;
}

/** Campos que muestran un error; los de la API se reconocen por la primera parte de su ruta. */
const CAMPOS_CON_ERROR = [
  'pruebaId',
  'contenidoId',
  'habilidadId',
  'tipoPregunta',
  'dificultadSugerida',
  'enunciado',
  'explicacion',
  'alternativas',
  'textoEstimuloId',
  'textoNuevo',
  'ordenEnTexto',
] as const;

export type ErroresPregunta = Partial<
  Record<(typeof CAMPOS_CON_ERROR)[number] | 'general', string>
>;

const TEXTO_VACIO: CamposTexto = {
  modo: 'guardado',
  id: undefined,
  nuevo: { tipoTexto: '', titulo: '', contenido: '', imagenUrl: '' },
  orden: '1',
};

const alternativa = (letra: Letra): CamposAlternativa => ({ letra, texto: '', explicacion: '' });

export function camposVacios(): CamposPregunta {
  return {
    pruebaId: undefined,
    ejeId: undefined,
    contenidoId: undefined,
    habilidadId: undefined,
    tipoPregunta: '',
    dificultadSugerida: '',
    enunciado: '',
    explicacion: '',
    alternativas: LETRAS.slice(0, 4).map(alternativa),
    correcta: undefined,
    texto: TEXTO_VACIO,
  };
}

/** «4» o «4 o 5»: cuántas alternativas admite la prueba (RN-08). */
export function cantidadDeAlternativas({ opcionesMin, opcionesMax }: PruebaTemario): string {
  return opcionesMin === opcionesMax
    ? String(opcionesMin)
    : `${String(opcionesMin)} o ${String(opcionesMax)}`;
}

export const pruebaDe = (pruebas: readonly PruebaTemario[], id: number | undefined) =>
  pruebas.find((prueba) => prueba.id === id);

/** Ajusta las alternativas a la cantidad que admite la prueba, sin perder lo ya escrito. */
export function ajustarAlternativas(campos: CamposPregunta, prueba: PruebaTemario): CamposPregunta {
  const cantidad = Math.min(
    Math.max(campos.alternativas.length, prueba.opcionesMin),
    prueba.opcionesMax,
  );
  const alternativas = LETRAS.slice(0, cantidad).map(
    (letra) => campos.alternativas.find((a) => a.letra === letra) ?? alternativa(letra),
  );
  const sigue = alternativas.some((a) => a.letra === campos.correcta);
  return { ...campos, alternativas, correcta: sigue ? campos.correcta : undefined };
}

/** Otra prueba: limpia el eje, el contenido y la habilidad, y elige su primer tipo de pregunta. */
export function conPrueba(
  campos: CamposPregunta,
  prueba: PruebaTemario | undefined,
): CamposPregunta {
  const limpios = {
    ...campos,
    pruebaId: prueba?.id,
    ejeId: undefined,
    contenidoId: undefined,
    habilidadId: undefined,
    tipoPregunta: prueba?.tiposPregunta[0]?.codigo ?? '',
  };
  return prueba ? ajustarAlternativas(limpios, prueba) : limpios;
}

/** M2 y Ciencias: agregar la E (true) o quitarla (false), dentro de lo que admite la prueba. */
export function cambiarCantidad(
  campos: CamposPregunta,
  prueba: PruebaTemario,
  agregar: boolean,
): CamposPregunta {
  const cantidad = campos.alternativas.length + (agregar ? 1 : -1);
  if (cantidad < prueba.opcionesMin || cantidad > prueba.opcionesMax) return campos;
  const alternativas = LETRAS.slice(0, cantidad).map(
    (letra) => campos.alternativas.find((a) => a.letra === letra) ?? alternativa(letra),
  );
  return ajustarAlternativas({ ...campos, alternativas }, prueba);
}

/** La pregunta guardada, lista para el formulario. */
export function camposDePregunta(pregunta: PreguntaParaEditar): CamposPregunta {
  return {
    pruebaId: pregunta.pruebaId,
    ejeId: pregunta.ejeId,
    contenidoId: pregunta.contenidoId,
    habilidadId: pregunta.habilidadId,
    tipoPregunta: pregunta.tipoPregunta,
    dificultadSugerida: pregunta.dificultadSugerida ?? '',
    enunciado: pregunta.enunciado,
    explicacion: pregunta.explicacion,
    alternativas: pregunta.alternativas.map(({ letra, texto, explicacion }) => ({
      letra,
      texto,
      explicacion: explicacion ?? '',
    })),
    correcta: pregunta.alternativas.find((a) => a.esCorrecta)?.letra,
    texto: {
      ...TEXTO_VACIO,
      id: pregunta.textoEstimuloId ?? undefined,
      orden: String(pregunta.ordenEnTexto ?? 1),
    },
  };
}

const vacio = (texto: string) => texto.trim() === '';

function errorDelTextoNuevo({ tipoTexto, titulo, contenido, imagenUrl }: CamposTexto['nuevo']) {
  if (vacio(tipoTexto)) return 'Elige el tipo de texto.';
  if (vacio(titulo)) return 'Escribe el título del texto.';
  if (vacio(contenido) && vacio(imagenUrl)) {
    return 'Escribe el texto o indica la dirección de su imagen.';
  }
  return undefined;
}

function erroresDelTexto(texto: CamposTexto, prueba: PruebaTemario): ErroresPregunta {
  const errores: ErroresPregunta = {};
  if (texto.modo === 'guardado' && texto.id === undefined) {
    errores.textoEstimuloId = `En ${prueba.nombre} cada pregunta va con su texto de lectura.`;
  }
  const delNuevo = texto.modo === 'nuevo' ? errorDelTextoNuevo(texto.nuevo) : undefined;
  if (delNuevo) errores.textoNuevo = delNuevo;
  if (!/^[1-9]\d{0,3}$/.test(texto.orden.trim())) {
    errores.ordenEnTexto = 'Indica el orden de la pregunta en el texto.';
  }
  return errores;
}

function errorDeAlternativas(campos: CamposPregunta): string | undefined {
  const sinTexto = campos.alternativas.find((a) => vacio(a.texto));
  if (sinTexto) return `Escribe el texto de la alternativa ${sinTexto.letra}.`;
  return campos.correcta ? undefined : 'Marca la alternativa correcta.';
}

/** Errores visibles antes de enviar. `prueba` es la elegida (undefined si falta). */
export function validarCampos(
  campos: CamposPregunta,
  prueba: PruebaTemario | undefined,
): ErroresPregunta {
  const errores: ErroresPregunta = {};
  if (!prueba) errores.pruebaId = 'Elige la prueba.';
  if (campos.contenidoId === undefined) errores.contenidoId = 'Elige el eje y el contenido.';
  if (campos.habilidadId === undefined) errores.habilidadId = 'Elige la habilidad.';
  if (vacio(campos.enunciado)) errores.enunciado = 'Escribe el enunciado.';
  if (vacio(campos.explicacion)) {
    errores.explicacion = 'Escribe la explicación de la respuesta correcta.';
  }
  const alternativas = errorDeAlternativas(campos);
  if (alternativas) errores.alternativas = alternativas;
  return prueba?.requiereTexto ? { ...errores, ...erroresDelTexto(campos.texto, prueba) } : errores;
}

const oNull = (texto: string) => (vacio(texto) ? null : texto.trim());

function textoNuevo({ nuevo }: CamposTexto): DatosTexto {
  return {
    tipoTexto: nuevo.tipoTexto,
    titulo: nuevo.titulo.trim(),
    contenido: oNull(nuevo.contenido),
    imagenUrl: oNull(nuevo.imagenUrl),
  };
}

/** Lo que se envía a la API. Sin texto de lectura si la prueba no lo usa. */
export function armarDatos(campos: CamposPregunta, prueba: PruebaTemario): DatosPregunta {
  const { texto } = campos;
  const conTexto = prueba.requiereTexto;
  return {
    pruebaId: prueba.id,
    contenidoId: campos.contenidoId ?? 0,
    habilidadId: campos.habilidadId ?? 0,
    tipoPregunta: campos.tipoPregunta,
    dificultadSugerida: oNull(campos.dificultadSugerida),
    enunciado: campos.enunciado.trim(),
    explicacion: campos.explicacion.trim(),
    textoEstimuloId: conTexto && texto.modo === 'guardado' ? (texto.id ?? null) : null,
    textoNuevo: conTexto && texto.modo === 'nuevo' ? textoNuevo(texto) : null,
    ordenEnTexto: conTexto ? Number(texto.orden) : null,
    alternativas: campos.alternativas.map(({ letra, texto: enunciado, explicacion }) => ({
      letra,
      texto: enunciado.trim(),
      esCorrecta: letra === campos.correcta,
      explicacion: oNull(explicacion),
    })),
  };
}

interface DetalleApi {
  ruta: string;
  mensaje: string;
}

const esDetalle = (valor: unknown): valor is DetalleApi =>
  typeof valor === 'object' && valor !== null && 'ruta' in valor && 'mensaje' in valor;

/**
 * Cada problema que devuelve la API va bajo su campo (textoNuevo.titulo va bajo textoNuevo); lo que no
 * es de un campo, como un 409 de RF-G09, va arriba del formulario.
 */
export function erroresDeApi(error: unknown): ErroresPregunta {
  const detalles = error instanceof ErrorApi && Array.isArray(error.detalles) ? error.detalles : [];
  const errores: ErroresPregunta = {};
  for (const detalle of detalles.filter(esDetalle)) {
    const campo = CAMPOS_CON_ERROR.find((c) => c === String(detalle.ruta).split('.')[0]);
    if (campo) errores[campo] ??= detalle.mensaje;
  }
  return Object.keys(errores).length > 0 ? errores : { general: mensajeDeError(error).mensaje };
}
