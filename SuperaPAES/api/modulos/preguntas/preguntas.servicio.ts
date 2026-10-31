// Reglas de negocio del módulo preguntas: banco de preguntas, alternativas, versiones, textos de
// estímulo, importaciones y avisos de error de los estudiantes.
// Es la única puerta de entrada al módulo: los demás módulos usan este servicio, nunca su repositorio.
import { ErrorValidacion } from '../../comun/errores.js';
import type { ProblemaDeCampo } from '../../comun/middleware/validacion.js';
import type { Paginacion } from '../../comun/respuesta.js';
import type { Ejecutor, UnidadDeTrabajo } from '../../db/transaccion.js';
import type { AdministracionServicio } from '../administracion/index.js';
import type { PruebaTemario, TemarioServicio } from '../temario/index.js';
import {
  crearPreguntasEdicionRepositorio,
  type PreguntasEdicionRepositorio,
} from './preguntas.edicion.repositorio.js';
import { crearEdicionPreguntas, type EdicionPreguntas } from './preguntas.edicion.servicio.js';
import {
  crearPreguntasRepositorio,
  type FilaBanco,
  type Opcion,
  type PreguntasRepositorio,
} from './preguntas.repositorio.js';
import {
  crearPreguntasTextosRepositorio,
  type PreguntasTextosRepositorio,
} from './preguntas.textos.repositorio.js';
import { crearTextosDeLectura, type TextosDeLectura } from './preguntas.textos.servicio.js';
import type { FiltrosBanco, OrigenPregunta } from './preguntas.validadores.js';

export interface DependenciasPreguntasServicio {
  bd: Ejecutor;
  unidadDeTrabajo: UnidadDeTrabajo;
  temario: TemarioServicio;
  /** Crear y editar preguntas queda en la auditoría (RNF-08). */
  administracion: Pick<AdministracionServicio, 'registrarAuditoria'>;
  /** Solo para pruebas: reemplaza al repositorio que se crea con crearPreguntasRepositorio(bd). */
  repositorio?: PreguntasRepositorio;
  /** Solo para pruebas: reemplaza al de crearPreguntasEdicionRepositorio(bd). */
  repositorioEdicion?: PreguntasEdicionRepositorio;
  /** Solo para pruebas: reemplaza al de crearPreguntasTextosRepositorio(bd). */
  repositorioTextos?: PreguntasTextosRepositorio;
}

/** Lo que la consola hace con los textos de lectura (HU-12.2); lo demás es para crear preguntas. */
type TextosDeLaConsola = Omit<TextosDeLectura, 'problemasDeTexto' | 'crearEnTransaccion'>;

/** Pregunta tal como la lista el banco (C02): con su estado y sin la alternativa correcta. */
export interface PreguntaDelBanco {
  id: string;
  /** Comienzo del enunciado (hasta 160 caracteres). */
  resumen: string;
  prueba: { id: number; codigo: string; nombre: string };
  eje: { id: number; nombre: string };
  contenido: { id: number; nombre: string };
  estado: Opcion;
  origen: OrigenPregunta;
  dificultadSugerida: Opcion | null;
  /** La que asignan los docentes (RN-12); el filtro de dificultad usa esta. */
  dificultadAsignada: Opcion | null;
  /** Un revisor dijo fácil y el otro difícil (C02: "posiblemente confusa"). */
  posibleAmbigua: boolean;
  actualizadoEn: string;
}

export interface PaginaDelBanco {
  preguntas: PreguntaDelBanco[];
  paginacion: Paginacion;
}

/** Opciones de los filtros del banco: el temario y las listas de estados, orígenes y dificultades. */
export interface FiltrosDelBanco {
  pruebas: PruebaTemario[];
  estados: Opcion[];
  origenes: Opcion[];
  dificultades: Opcion[];
}

export interface PreguntasServicio extends EdicionPreguntas, TextosDeLaConsola {
  /**
   * HU-11 y RF-G01: el banco filtrado por prueba, eje, contenido, habilidad, estado, origen y
   * dificultad.
   */
  listarBanco(filtros: FiltrosBanco): Promise<PaginaDelBanco>;
  filtrosDelBanco(): Promise<FiltrosDelBanco>;
}

/** Nombres de los orígenes (HU-11 esc. 1: manual, importada o IA). */
const ORIGENES: Opcion[] = [
  { codigo: 'manual', nombre: 'Manual' },
  { codigo: 'importacion', nombre: 'Importada' },
  { codigo: 'ia', nombre: 'IA' },
];

interface UbicacionContenido {
  prueba: PreguntaDelBanco['prueba'];
  eje: PreguntaDelBanco['eje'];
  contenido: PreguntaDelBanco['contenido'];
}

/** Índices del temario para resolver los filtros y nombrar cada pregunta. */
interface IndiceTemario {
  pruebas: Set<number>;
  ejes: Map<number, { pruebaId: number; contenidoIds: number[] }>;
  contenidos: Map<number, UbicacionContenido>;
  /** Prueba de cada habilidad. */
  habilidades: Map<number, number>;
}

function indexarTemario(pruebas: readonly PruebaTemario[]): IndiceTemario {
  const indice: IndiceTemario = {
    pruebas: new Set(),
    ejes: new Map(),
    contenidos: new Map(),
    habilidades: new Map(),
  };
  for (const { ejes, habilidades, ...prueba } of pruebas) {
    indice.pruebas.add(prueba.id);
    for (const habilidad of habilidades) indice.habilidades.set(habilidad.id, prueba.id);
    for (const { contenidos, ...eje } of ejes) {
      indice.ejes.set(eje.id, { pruebaId: prueba.id, contenidoIds: contenidos.map((c) => c.id) });
      for (const contenido of contenidos) {
        const { id, codigo, nombre } = prueba;
        indice.contenidos.set(contenido.id, { prueba: { id, codigo, nombre }, eje, contenido });
      }
    }
  }
  return indice;
}

function errorDeFiltro(ruta: string, mensaje: string): ErrorValidacion {
  const problema: ProblemaDeCampo = { lugar: 'consulta', ruta, mensaje };
  return new ErrorValidacion([problema], mensaje);
}

/** El eje elegido existe y, si hay prueba, es de esa prueba. */
function ejeDelFiltro(filtros: FiltrosBanco, indice: IndiceTemario) {
  if (filtros.eje === undefined) return undefined;
  const eje = indice.ejes.get(filtros.eje);
  if (!eje) throw errorDeFiltro('eje', 'El eje no existe.');
  if (filtros.prueba !== undefined && eje.pruebaId !== filtros.prueba) {
    throw errorDeFiltro('eje', 'El eje no es de la prueba elegida.');
  }
  return eje;
}

/** El contenido elegido existe y es de la prueba y del eje elegidos, si los hay. */
function comprobarContenido(filtros: FiltrosBanco, indice: IndiceTemario): void {
  if (filtros.contenido === undefined) return;
  const ubicacion = indice.contenidos.get(filtros.contenido);
  if (!ubicacion) throw errorDeFiltro('contenido', 'El contenido no existe.');
  const deOtraPrueba = filtros.prueba !== undefined && ubicacion.prueba.id !== filtros.prueba;
  const deOtroEje = filtros.eje !== undefined && ubicacion.eje.id !== filtros.eje;
  if (deOtraPrueba || deOtroEje) {
    throw errorDeFiltro('contenido', 'El contenido no es del eje o la prueba elegidos.');
  }
}

/** La habilidad elegida existe y, si hay prueba, es de esa prueba. */
function comprobarHabilidad(filtros: FiltrosBanco, indice: IndiceTemario): void {
  if (filtros.habilidad === undefined) return;
  const pruebaId = indice.habilidades.get(filtros.habilidad);
  if (pruebaId === undefined) throw errorDeFiltro('habilidad', 'La habilidad no existe.');
  if (filtros.prueba !== undefined && pruebaId !== filtros.prueba) {
    throw errorDeFiltro('habilidad', 'La habilidad no es de la prueba elegida.');
  }
}

/**
 * Convierte prueba, eje, contenido y habilidad en lo que filtra la base. La pregunta no guarda el eje:
 * elegir un eje es elegir todos sus contenidos.
 */
function resolverTemario(filtros: FiltrosBanco, indice: IndiceTemario) {
  if (filtros.prueba !== undefined && !indice.pruebas.has(filtros.prueba)) {
    throw errorDeFiltro('prueba', 'La prueba no existe.');
  }
  const eje = ejeDelFiltro(filtros, indice);
  comprobarContenido(filtros, indice);
  comprobarHabilidad(filtros, indice);
  const contenidoIds = filtros.contenido === undefined ? eje?.contenidoIds : [filtros.contenido];
  return { pruebaId: filtros.prueba, contenidoIds, habilidadId: filtros.habilidad };
}

async function comprobarCodigo(
  codigo: string | undefined,
  opciones: () => Promise<Opcion[]>,
  [ruta, mensaje]: [string, string],
): Promise<void> {
  if (codigo === undefined) return;
  if (!(await opciones()).some((opcion) => opcion.codigo === codigo)) {
    throw errorDeFiltro(ruta, mensaje);
  }
}

function aPreguntaDelBanco(fila: FilaBanco, indice: IndiceTemario): PreguntaDelBanco {
  const ubicacion = indice.contenidos.get(fila.contenidoId);
  // La clave foránea (contenido_id, prueba_id) lo garantiza: si falta, el temario no está completo.
  if (!ubicacion)
    throw new Error(`El contenido ${String(fila.contenidoId)} no está en el temario.`);
  return {
    id: fila.id,
    resumen: fila.resumen,
    ...ubicacion,
    estado: fila.estado,
    origen: fila.origen,
    dificultadSugerida: fila.dificultadSugerida,
    dificultadAsignada: fila.dificultadAsignada,
    posibleAmbigua: fila.posibleAmbigua,
    actualizadoEn: fila.actualizadoEn.toISOString(),
  };
}

async function listarBanco(
  repositorio: PreguntasRepositorio,
  temario: TemarioServicio,
  filtros: FiltrosBanco,
): Promise<PaginaDelBanco> {
  const indice = indexarTemario(await temario.listarTemario());
  const { pruebaId, contenidoIds, habilidadId } = resolverTemario(filtros, indice);
  await comprobarCodigo(filtros.estado, () => repositorio.listarEstados(), [
    'estado',
    'El estado no existe.',
  ]);
  await comprobarCodigo(filtros.dificultad, () => repositorio.listarDificultades(), [
    'dificultad',
    'La dificultad no existe.',
  ]);
  const { pagina, porPagina } = filtros;
  const { filas, total } = await repositorio.listarBanco({
    pruebaId,
    contenidoIds,
    habilidadId,
    estado: filtros.estado,
    origen: filtros.origen,
    dificultad: filtros.dificultad,
    limite: porPagina,
    desde: (pagina - 1) * porPagina,
  });
  return {
    preguntas: filas.map((fila) => aPreguntaDelBanco(fila, indice)),
    paginacion: { pagina, porPagina, total },
  };
}

export function crearPreguntasServicio(
  dependencias: DependenciasPreguntasServicio,
): PreguntasServicio {
  const repositorio = dependencias.repositorio ?? crearPreguntasRepositorio(dependencias.bd);
  const { temario, unidadDeTrabajo } = dependencias;
  const auditoria = dependencias.administracion;
  const textos = crearTextosDeLectura({
    unidadDeTrabajo,
    auditoria,
    repositorio: dependencias.repositorioTextos ?? crearPreguntasTextosRepositorio(dependencias.bd),
  });
  const edicion = crearEdicionPreguntas({
    unidadDeTrabajo,
    temario,
    auditoria,
    repositorio:
      dependencias.repositorioEdicion ?? crearPreguntasEdicionRepositorio(dependencias.bd),
    listas: repositorio,
    textos,
  });
  return {
    ...edicion,
    listarTextos: (consulta) => textos.listarTextos(consulta),
    obtenerTexto: (id) => textos.obtenerTexto(id),
    crearTexto: (autorId, datos) => textos.crearTexto(autorId, datos),
    editarTexto: (autorId, id, datos) => textos.editarTexto(autorId, id, datos),
    tiposDeTexto: () => textos.tiposDeTexto(),
    listarBanco: (filtros) => listarBanco(repositorio, temario, filtros),
    // Una consulta tras otra: así también sirve con una sola conexión (una transacción o un cliente).
    async filtrosDelBanco() {
      const pruebas = await temario.listarTemario();
      const estados = await repositorio.listarEstados();
      const dificultades = await repositorio.listarDificultades();
      return { pruebas, estados, origenes: ORIGENES, dificultades };
    },
  };
}
