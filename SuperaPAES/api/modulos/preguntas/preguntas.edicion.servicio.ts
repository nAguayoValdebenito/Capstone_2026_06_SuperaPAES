// Crear, obtener y editar preguntas con sus alternativas (HU-12.1, RF-G02, RF-G09, CU-15, C03).
// La pregunta y sus alternativas se guardan en una transacción con el autor fijado para los triggers, y
// cada cambio queda en la auditoría (RNF-08). Las reglas de RN-08 están en preguntas.reglas.ts. Un texto
// de lectura nuevo (HU-12.2) se crea en la misma transacción que la pregunta.
import { ErrorConflicto, ErrorNoEncontrado, ErrorValidacion } from '../../comun/errores.js';
import type { Ejecutor, UnidadDeTrabajo } from '../../db/transaccion.js';
import type { AdministracionServicio } from '../administracion/index.js';
import type { PruebaTemario, TemarioServicio } from '../temario/index.js';
import type { FilaPregunta, PreguntasEdicionRepositorio } from './preguntas.edicion.repositorio.js';
import { problemasDePregunta } from './preguntas.reglas.js';
import type { PreguntasRepositorio } from './preguntas.repositorio.js';
import type { TextosDeLectura } from './preguntas.textos.servicio.js';
import type { DatosPregunta } from './preguntas.validadores.js';

/** La pregunta para el formulario de la consola: con su eje (sale del contenido) y la correcta. */
export interface PreguntaParaEditar extends Omit<FilaPregunta, 'actualizadoEn'> {
  ejeId: number;
  actualizadoEn: string;
}

export interface EdicionPreguntas {
  /** CU-15: la pregunta nueva queda en borrador (HU-12 esc. 4). */
  crearPregunta(autorId: string, datos: DatosPregunta): Promise<PreguntaParaEditar>;
  obtenerPregunta(id: string): Promise<PreguntaParaEditar>;
  /** RF-G09: solo en una etapa editable (borrador u observada); si no, 409. */
  editarPregunta(autorId: string, id: string, datos: DatosPregunta): Promise<PreguntaParaEditar>;
}

export interface DependenciasEdicionPreguntas {
  unidadDeTrabajo: UnidadDeTrabajo;
  temario: TemarioServicio;
  auditoria: Pick<AdministracionServicio, 'registrarAuditoria'>;
  repositorio: PreguntasEdicionRepositorio;
  listas: Pick<PreguntasRepositorio, 'listarDificultades'>;
  textos: Pick<TextosDeLectura, 'problemasDeTexto' | 'crearEnTransaccion'>;
}

const ENTIDAD_PREGUNTA = 'pregunta';

/** Tablas que guardan una alternativa: la versión enviada a revisión y las evaluaciones. */
const USAN_ALTERNATIVAS = new Set(['pregunta_version', 'evaluacion_item']);

interface ErrorDeBase {
  code: string;
  table?: string;
  message: string;
}

function esErrorDeBase(error: unknown): error is ErrorDeBase {
  return typeof error === 'object' && error !== null && 'code' in error && 'message' in error;
}

/**
 * Los rechazos de la base llegan como 409 con un mensaje en español, sin el SQL. Los triggers del ciclo
 * de vida (P0001) ya escriben su motivo para personas.
 */
async function traducirErrores<T>(trabajo: () => Promise<T>): Promise<T> {
  try {
    return await trabajo();
  } catch (error) {
    if (!esErrorDeBase(error)) throw error;
    if (error.code === 'P0001') throw new ErrorConflicto(error.message);
    if (error.code === '23503' && error.table !== undefined && USAN_ALTERNATIVAS.has(error.table)) {
      throw new ErrorConflicto(
        'No se puede quitar una alternativa que ya está en una versión guardada o en una evaluación.',
      );
    }
    throw error;
  }
}

function ejeDe(temario: readonly PruebaTemario[], contenidoId: number): number {
  for (const eje of temario.flatMap((prueba) => prueba.ejes)) {
    if (eje.contenidos.some((contenido) => contenido.id === contenidoId)) return eje.id;
  }
  // La clave foránea (contenido_id, prueba_id) lo garantiza: si falta, el temario no está completo.
  throw new Error(`El contenido ${String(contenidoId)} no está en el temario.`);
}

function aPreguntaParaEditar(
  fila: FilaPregunta,
  pruebas: readonly PruebaTemario[],
): PreguntaParaEditar {
  const { actualizadoEn, ...resto } = fila;
  return {
    ...resto,
    ejeId: ejeDe(pruebas, fila.contenidoId),
    actualizadoEn: actualizadoEn.toISOString(),
  };
}

async function leer(
  repositorio: PreguntasEdicionRepositorio,
  id: string,
  pruebas: readonly PruebaTemario[],
  tx?: Ejecutor,
): Promise<PreguntaParaEditar> {
  const fila = await repositorio.obtener(id, tx);
  if (!fila) throw new ErrorNoEncontrado('La pregunta no existe.');
  return aPreguntaParaEditar(fila, pruebas);
}

/** Revisa la pregunta contra su prueba; devuelve el temario para no volver a pedirlo. */
async function comprobar(
  { temario, listas, repositorio, textos }: DependenciasEdicionPreguntas,
  datos: DatosPregunta,
): Promise<PruebaTemario[]> {
  const pruebas = await temario.listarTemario();
  const prueba = pruebas.find((candidata) => candidata.id === datos.pruebaId);
  const dificultades = await listas.listarDificultades();
  const existeTexto =
    datos.textoEstimuloId !== null && (await repositorio.existeTexto(datos.textoEstimuloId));
  const problemas = [
    ...problemasDePregunta(datos, prueba, dificultades, existeTexto),
    ...(datos.textoNuevo ? await textos.problemasDeTexto(datos.textoNuevo, 'textoNuevo.') : []),
  ];
  if (problemas.length > 0) throw new ErrorValidacion(problemas, problemas[0]?.mensaje);
  return pruebas;
}

async function guardarAlternativas(
  repositorio: PreguntasEdicionRepositorio,
  id: string,
  datos: DatosPregunta,
  tx: Ejecutor,
): Promise<void> {
  await repositorio.guardarAlternativas(id, datos.alternativas, tx);
  const letras = datos.alternativas.map((alternativa) => alternativa.letra);
  await repositorio.quitarAlternativas(id, letras, tx);
}

/** Crea el texto nuevo, si viene, y devuelve los datos de la pregunta con el id de su texto. */
async function conTextoGuardado(
  { textos }: DependenciasEdicionPreguntas,
  autorId: string,
  datos: DatosPregunta,
  tx: Ejecutor,
): Promise<DatosPregunta> {
  if (!datos.textoNuevo) return datos;
  const textoId = await textos.crearEnTransaccion(autorId, datos.textoNuevo, tx);
  return { ...datos, textoEstimuloId: Number(textoId), textoNuevo: null };
}

async function auditar(
  { auditoria }: DependenciasEdicionPreguntas,
  autorId: string,
  [antes, despues]: [PreguntaParaEditar | null, PreguntaParaEditar],
  tx: Ejecutor,
): Promise<void> {
  await auditoria.registrarAuditoria(
    {
      usuarioId: autorId,
      accion: antes ? 'editar_pregunta' : 'crear_pregunta',
      entidad: ENTIDAD_PREGUNTA,
      entidadId: despues.id,
      antes: antes && { ...antes },
      despues: { ...despues },
    },
    tx,
  );
}

async function crearPregunta(
  dependencias: DependenciasEdicionPreguntas,
  autorId: string,
  datos: DatosPregunta,
): Promise<PreguntaParaEditar> {
  const { unidadDeTrabajo, repositorio } = dependencias;
  const pruebas = await comprobar(dependencias, datos);
  return traducirErrores(() =>
    unidadDeTrabajo.enTransaccion(async (tx) => {
      await repositorio.fijarAutor(autorId, tx);
      const conTexto = await conTextoGuardado(dependencias, autorId, datos, tx);
      const id = await repositorio.insertar(conTexto, autorId, tx);
      await guardarAlternativas(repositorio, id, conTexto, tx);
      const creada = await leer(repositorio, id, pruebas, tx);
      await auditar(dependencias, autorId, [null, creada], tx);
      return creada;
    }),
  );
}

async function editarPregunta(
  dependencias: DependenciasEdicionPreguntas,
  autorId: string,
  [id, datos]: [string, DatosPregunta],
): Promise<PreguntaParaEditar> {
  const { unidadDeTrabajo, repositorio } = dependencias;
  const pruebas = await comprobar(dependencias, datos);
  return traducirErrores(() =>
    unidadDeTrabajo.enTransaccion(async (tx) => {
      await repositorio.fijarAutor(autorId, tx);
      const fila = await repositorio.obtener(id, tx, true);
      if (!fila) throw new ErrorNoEncontrado('La pregunta no existe.');
      if (!fila.editable) {
        throw new ErrorConflicto(
          `La pregunta está «${fila.estado.nombre}» y no se puede editar: solo se editan las preguntas en una etapa editable, como borrador u observada (RF-G09).`,
        );
      }
      const antes = aPreguntaParaEditar(fila, pruebas);
      const conTexto = await conTextoGuardado(dependencias, autorId, datos, tx);
      await repositorio.actualizar(id, conTexto, tx);
      await guardarAlternativas(repositorio, id, conTexto, tx);
      const editada = await leer(repositorio, id, pruebas, tx);
      await auditar(dependencias, autorId, [antes, editada], tx);
      return editada;
    }),
  );
}

export function crearEdicionPreguntas(
  dependencias: DependenciasEdicionPreguntas,
): EdicionPreguntas {
  const { temario, repositorio } = dependencias;
  return {
    crearPregunta: (autorId, datos) => crearPregunta(dependencias, autorId, datos),
    obtenerPregunta: async (id) => leer(repositorio, id, await temario.listarTemario()),
    editarPregunta: (autorId, id, datos) => editarPregunta(dependencias, autorId, [id, datos]),
  };
}
