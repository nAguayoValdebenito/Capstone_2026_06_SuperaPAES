// Importar preguntas desde la plantilla CSV (HU-13.1, CU-16, RF-G05, C04). Revisar lee los archivos y
// entrega el informe sin guardar nada (pasos 3 a 5); importar vuelve a revisarlos, exige la declaración
// del origen (paso 6, RN-29) y, en una transacción, registra la importación, crea los textos que usan
// las preguntas válidas y las preguntas como borrador con la dificultad solo sugerida (paso 7, RN-12),
// y deja la importación en la auditoría con quien la hizo y su declaración.
import { ErrorValidacion } from '../../comun/errores.js';
import type { Ejecutor, UnidadDeTrabajo } from '../../db/transaccion.js';
import type { AdministracionServicio } from '../administracion/index.js';
import type { TemarioServicio } from '../temario/index.js';
import type {
  AlternativaNueva,
  PreguntasEdicionRepositorio,
} from './preguntas.edicion.repositorio.js';
import {
  crearBuscador,
  type ErrorDeFila,
  type TextoDelArchivo,
} from './preguntas.importacion.comun.js';
import { leerPregunta, type PreguntaDelArchivo } from './preguntas.importacion.filas.js';
import { leerTextos } from './preguntas.importacion.textos.js';
import type { PreguntasImportacionRepositorio } from './preguntas.importacion.repositorio.js';
import {
  COLUMNAS_PREGUNTAS,
  COLUMNAS_TEXTOS,
  leerArchivo,
  obtenerPlantillasImportacion,
} from './preguntas.plantilla.js';
import type { PreguntasRepositorio } from './preguntas.repositorio.js';
import type { TextosDeLectura } from './preguntas.textos.servicio.js';
import type { ArchivosImportacion, DatosImportacion, DatosTexto } from './preguntas.validadores.js';

/** El informe de C04: filas leídas, por crear, omitidas (en blanco) y con error, con sus motivos. */
export interface InformeImportacion {
  filasLeidas: number;
  porCrear: number;
  omitidas: number;
  conError: number;
  /** Textos de lectura que se crean: los que usan las preguntas por crear. */
  textosPorCrear: number;
  errores: ErrorDeFila[];
}

/** La importación hecha: su id y el informe de lo que se creó. */
export interface ImportacionHecha extends InformeImportacion {
  id: string;
}

export interface ImportacionPreguntas {
  /** CU-16 paso 1: plantillas CSV vacías, sin cargar material de terceros (RN-29). */
  obtenerPlantillasImportacion(): ReturnType<typeof obtenerPlantillasImportacion>;
  /** CU-16 pasos 3 a 5: el informe, sin guardar nada. */
  revisarImportacion(archivos: ArchivosImportacion): Promise<InformeImportacion>;
  /** CU-16 pasos 6 y 7: crea las preguntas válidas. Sin ninguna válida, 400. */
  importarPreguntas(autorId: string, datos: DatosImportacion): Promise<ImportacionHecha>;
}

export interface DependenciasImportacion {
  unidadDeTrabajo: UnidadDeTrabajo;
  temario: TemarioServicio;
  auditoria: Pick<AdministracionServicio, 'registrarAuditoria'>;
  repositorio: PreguntasImportacionRepositorio;
  preguntas: Pick<PreguntasEdicionRepositorio, 'fijarAutor' | 'insertar' | 'insertarAlternativas'>;
  listas: Pick<PreguntasRepositorio, 'listarDificultades'>;
  textos: Pick<TextosDeLectura, 'tiposDeTexto' | 'crearEnTransaccion'>;
}

/** Lo que el administrador declara al confirmar (CU-16 paso 6); queda en la auditoría (RN-29). */
const DECLARACION_ORIGEN =
  'Las preguntas son propias o tienen permiso de uso y no provienen de los facsímiles del DEMRE ni de otro material protegido.';

interface Revision {
  informe: InformeImportacion;
  preguntas: PreguntaDelArchivo[];
  /** Los textos que usan las preguntas por crear, por su código normalizado. */
  textos: Map<string, DatosTexto>;
}

/** Cada pregunta con texto lleva su orden en él: el de sus filas, desde 1 (el modelo lo exige). */
function conOrdenEnTextos(preguntas: readonly PreguntaDelArchivo[]): PreguntaDelArchivo[] {
  const cuantas = new Map<string, number>();
  return preguntas.map((pregunta) => {
    if (pregunta.codigoTexto === null) return pregunta;
    const orden = (cuantas.get(pregunta.codigoTexto) ?? 0) + 1;
    cuantas.set(pregunta.codigoTexto, orden);
    return { ...pregunta, datos: { ...pregunta.datos, ordenEnTexto: orden } };
  });
}

/** Los textos del archivo de textos, si viene, con las filas que tienen problemas. */
async function textosDelArchivo(
  dependencias: DependenciasImportacion,
  archivos: ArchivosImportacion,
) {
  if (!archivos.textos) return { textos: new Map<string, TextoDelArchivo>(), errores: [] };
  const filas = leerArchivo(archivos.textos, COLUMNAS_TEXTOS, { exigeFilas: false });
  return leerTextos(filas, await dependencias.textos.tiposDeTexto());
}

async function revisar(
  dependencias: DependenciasImportacion,
  archivos: ArchivosImportacion,
): Promise<Revision> {
  const filas = leerArchivo(archivos.preguntas, COLUMNAS_PREGUNTAS);
  const textos = await textosDelArchivo(dependencias, archivos);
  const contexto = {
    buscar: crearBuscador(),
    pruebas: await dependencias.temario.listarTemario(),
    dificultades: await dependencias.listas.listarDificultades(),
    textos: textos.textos,
  };
  const validas: PreguntaDelArchivo[] = [];
  const errores: ErrorDeFila[] = [];
  for (const fila of filas.filter((candidata) => !candidata.enBlanco)) {
    const leida = leerPregunta(fila, contexto);
    if ('motivos' in leida) errores.push(leida);
    else validas.push(leida);
  }
  const preguntas = conOrdenEnTextos(validas);
  const usados = new Map<string, DatosTexto>();
  for (const { codigoTexto } of preguntas) {
    const datos = codigoTexto === null ? null : textos.textos.get(codigoTexto)?.datos;
    if (codigoTexto !== null && datos) usados.set(codigoTexto, datos);
  }
  const informe = {
    filasLeidas: filas.length,
    porCrear: preguntas.length,
    omitidas: filas.filter((fila) => fila.enBlanco).length,
    conError: errores.length,
    textosPorCrear: usados.size,
    errores: [...errores, ...textos.errores],
  };
  return { informe, preguntas, textos: usados };
}

/** Crea los textos usados y devuelve sus ids por código. */
async function crearTextos(
  { textos }: DependenciasImportacion,
  autorId: string,
  porCrear: Revision['textos'],
  tx: Ejecutor,
): Promise<Map<string, number>> {
  const ids = new Map<string, number>();
  for (const [codigo, datos] of porCrear) {
    ids.set(codigo, Number(await textos.crearEnTransaccion(autorId, datos, tx)));
  }
  return ids;
}

/** Crea cada pregunta con su texto y, al final, todas sus alternativas en una sola consulta. */
async function crearPreguntas(
  dependencias: DependenciasImportacion,
  { autorId, importacionId }: { autorId: string; importacionId: string },
  { preguntas, idsTextos }: { preguntas: PreguntaDelArchivo[]; idsTextos: Map<string, number> },
  tx: Ejecutor,
): Promise<void> {
  const alternativas: AlternativaNueva[] = [];
  for (const { datos, codigoTexto } of preguntas) {
    const textoEstimuloId = codigoTexto === null ? null : (idsTextos.get(codigoTexto) ?? null);
    const preguntaId = await dependencias.preguntas.insertar(
      { ...datos, textoEstimuloId },
      autorId,
      tx,
      importacionId,
    );
    alternativas.push(...datos.alternativas.map((a) => ({ preguntaId, ...a })));
  }
  await dependencias.preguntas.insertarAlternativas(alternativas, tx);
}

async function importar(
  dependencias: DependenciasImportacion,
  autorId: string,
  datos: DatosImportacion,
): Promise<ImportacionHecha> {
  const { informe, preguntas, textos } = await revisar(dependencias, datos);
  if (preguntas.length === 0) {
    const mensaje = 'El archivo no tiene preguntas válidas para importar.';
    throw new ErrorValidacion([{ lugar: 'cuerpo', ruta: 'preguntas', mensaje }], mensaje);
  }
  return dependencias.unidadDeTrabajo.enTransaccion(async (tx) => {
    await dependencias.preguntas.fijarAutor(autorId, tx);
    const id = await dependencias.repositorio.insertar(
      {
        usuarioId: autorId,
        nombreArchivo: datos.preguntas.nombre,
        filasTotal: informe.filasLeidas,
        filasCreadas: informe.porCrear,
        filasConError: informe.conError,
        errores: informe.errores,
      },
      tx,
    );
    const idsTextos = await crearTextos(dependencias, autorId, textos, tx);
    await crearPreguntas(
      dependencias,
      { autorId, importacionId: id },
      { preguntas, idsTextos },
      tx,
    );
    const hecha = { id, ...informe };
    await auditar(dependencias, [autorId, datos, hecha], tx);
    return hecha;
  });
}

/** RN-29: la importación queda en la auditoría con quien la hizo y su declaración del origen. */
async function auditar(
  { auditoria }: DependenciasImportacion,
  [autorId, datos, hecha]: [string, DatosImportacion, ImportacionHecha],
  tx: Ejecutor,
): Promise<void> {
  await auditoria.registrarAuditoria(
    {
      usuarioId: autorId,
      accion: 'importar_preguntas',
      entidad: 'importacion',
      entidadId: hecha.id,
      antes: null,
      despues: {
        archivo: datos.preguntas.nombre,
        archivoTextos: datos.textos?.nombre ?? null,
        filasLeidas: hecha.filasLeidas,
        creadas: hecha.porCrear,
        omitidas: hecha.omitidas,
        conError: hecha.conError,
        textosCreados: hecha.textosPorCrear,
        declaracionOrigen: DECLARACION_ORIGEN,
      },
    },
    tx,
  );
}

export function crearImportacionPreguntas(
  dependencias: DependenciasImportacion,
): ImportacionPreguntas {
  return {
    obtenerPlantillasImportacion,
    revisarImportacion: async (archivos) => (await revisar(dependencias, archivos)).informe,
    importarPreguntas: (autorId, datos) => importar(dependencias, autorId, datos),
  };
}
