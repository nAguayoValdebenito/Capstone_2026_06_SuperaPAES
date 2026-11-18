// Reglas de negocio del módulo preguntas: banco de preguntas, alternativas, versiones, textos de
// estímulo, importaciones y avisos de error de los estudiantes.
// Es la única puerta de entrada al módulo: los demás módulos usan este servicio, nunca su repositorio.
import type { Ejecutor, UnidadDeTrabajo } from '../../db/transaccion.js';
import type { AdministracionServicio } from '../administracion/index.js';
import type { TemarioServicio } from '../temario/index.js';
import type { AvisosRepositorio } from './preguntas.avisos.repositorio.js';
import type { AnulacionPreguntas } from './preguntas.anulacion.servicio.js';
import { crearAvisosDeError, type AvisosDeError } from './preguntas.avisos.servicio.js';
import {
  crearAvisosDeEstudiantes,
  type AvisosDeEstudiantes,
  type DependenciasAvisosApp,
} from './preguntas.avisos-app.servicio.js';
import {
  crearBusquedaPreguntas,
  crearBusquedaRepositorio,
  type BusquedaPreguntas,
  type BusquedaRepositorio,
} from './preguntas.busqueda.js';
import type { FiltrosDelBanco, PaginaDelBanco, PreguntaDelBanco } from './preguntas.banco.tipos.js';
import { type IndiceTemario, indexarTemario, resolverFiltros } from './preguntas.filtros-banco.js';
import * as imagenes from './preguntas.imagenes.servicio.js';
import { crearLoteRepositorio } from './preguntas.lote.repositorio.js';
import { crearLotePreguntas, type LotePreguntas } from './preguntas.lote.servicio.js';
import {
  crearPreguntasEdicionRepositorio,
  type PreguntasEdicionRepositorio,
} from './preguntas.edicion.repositorio.js';
import { crearEdicionPreguntas, type EdicionPreguntas } from './preguntas.edicion.servicio.js';
import {
  crearPublicacionRepositorio,
  type PublicacionRepositorio,
} from './preguntas.publicacion.repositorio.js';
import {
  crearPublicacionPreguntas,
  type PublicacionPreguntas,
} from './preguntas.publicacion.servicio.js';
import {
  crearPreguntasGeneracionRepositorio,
  type LecturasParaGenerar,
} from './preguntas.generacion.repositorio.js';
import {
  crearPreguntasImportacionRepositorio,
  type PreguntasImportacionRepositorio,
} from './preguntas.importacion.repositorio.js';
import {
  crearImportacionPreguntas,
  type ImportacionPreguntas,
} from './preguntas.importacion.servicio.js';
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
import type { FiltrosBanco } from './preguntas.validadores.js';

export interface DependenciasPreguntasServicio
  extends Pick<imagenes.DependenciasImagenes, 'repositorioImagenes'>, DependenciasAvisosApp {
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
  /** Solo para pruebas: reemplaza al de crearPreguntasImportacionRepositorio(). */
  repositorioImportacion?: PreguntasImportacionRepositorio;
  /** Solo para pruebas: reemplaza al de crearPublicacionRepositorio(). */
  repositorioPublicacion?: PublicacionRepositorio;
  /** Solo para pruebas: reemplaza al de crearAvisosRepositorio(bd). */
  repositorioAvisos?: AvisosRepositorio;
  /** Solo para pruebas: reemplaza al de crearBusquedaRepositorio(bd). */
  repositorioBusqueda?: BusquedaRepositorio;
}

/** Lo que la consola hace con los textos de lectura (HU-12.2); lo demás es para crear preguntas. */
type TextosDeLaConsola = Omit<TextosDeLectura, 'problemasDeTexto' | 'crearEnTransaccion'>;

export interface PreguntasServicio
  extends
    EdicionPreguntas,
    TextosDeLaConsola,
    ImportacionPreguntas,
    LecturasParaGenerar,
    PublicacionPreguntas,
    LotePreguntas,
    AvisosDeError,
    AvisosDeEstudiantes,
    BusquedaPreguntas,
    AnulacionPreguntas,
    imagenes.ImagenesDePreguntas {
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
    editable: fila.editable,
    actualizadoEn: fila.actualizadoEn.toISOString(),
  };
}

async function listarBanco(
  repositorio: PreguntasRepositorio,
  temario: TemarioServicio,
  filtros: FiltrosBanco,
): Promise<PaginaDelBanco> {
  const indice = indexarTemario(await temario.listarTemario());
  const filtro = await resolverFiltros(repositorio, indice, filtros);
  const { pagina, porPagina } = filtros;
  const { filas, total } = await repositorio.listarBanco({
    ...filtro,
    limite: porPagina,
    desde: (pagina - 1) * porPagina,
  });
  return {
    preguntas: filas.map((fila) => aPreguntaDelBanco(fila, indice)),
    paginacion: { pagina, porPagina, total },
  };
}

/** Las partes del módulo que escriben: textos de lectura, edición, importación y publicación. */
function crearPartes(
  dependencias: DependenciasPreguntasServicio,
  repositorio: PreguntasRepositorio,
) {
  const { temario, unidadDeTrabajo } = dependencias;
  const auditoria = dependencias.administracion;
  const textos = crearTextosDeLectura({
    unidadDeTrabajo,
    auditoria,
    repositorio: dependencias.repositorioTextos ?? crearPreguntasTextosRepositorio(dependencias.bd),
  });
  const repositorioEdicion =
    dependencias.repositorioEdicion ?? crearPreguntasEdicionRepositorio(dependencias.bd);
  const edicion = crearEdicionPreguntas({
    unidadDeTrabajo,
    temario,
    auditoria,
    repositorio: repositorioEdicion,
    listas: repositorio,
    textos,
  });
  const importacion = crearImportacionPreguntas({
    unidadDeTrabajo,
    temario,
    auditoria,
    repositorio: dependencias.repositorioImportacion ?? crearPreguntasImportacionRepositorio(),
    preguntas: repositorioEdicion,
    listas: repositorio,
    textos,
  });
  const publicar = {
    unidadDeTrabajo,
    auditoria,
    autor: repositorioEdicion,
    repositorio: dependencias.repositorioPublicacion ?? crearPublicacionRepositorio(),
  };
  const lote = crearLotePreguntas({
    ...publicar,
    lote: crearLoteRepositorio(dependencias.bd),
    resolver: async (filtros) =>
      resolverFiltros(repositorio, indexarTemario(await temario.listarTemario()), filtros),
  });
  return { textos, edicion, importacion, publicacion: crearPublicacionPreguntas(publicar), lote };
}

export function crearPreguntasServicio(
  dependencias: DependenciasPreguntasServicio,
): PreguntasServicio {
  const repositorio = dependencias.repositorio ?? crearPreguntasRepositorio(dependencias.bd);
  const { temario } = dependencias;
  const { textos, edicion, importacion, publicacion, lote } = crearPartes(
    dependencias,
    repositorio,
  );
  const generacion = crearPreguntasGeneracionRepositorio(dependencias.bd);
  return {
    ...edicion,
    ...importacion,
    ...publicacion,
    ...lote,
    ...crearAvisosDeError(dependencias),
    ...crearAvisosDeEstudiantes(dependencias),
    ...crearBusquedaPreguntas(
      dependencias.repositorioBusqueda ?? crearBusquedaRepositorio(dependencias.bd),
    ),
    ...imagenes.crearImagenesDePreguntas(dependencias),
    enunciadosDelContenido: (contenidoId, tx) => generacion.enunciadosDelContenido(contenidoId, tx),
    ejemplosAprobados: (contenidoId, limite) => generacion.ejemplosAprobados(contenidoId, limite),
    guardarPropuestaDeIa: (propuesta, tx) => generacion.guardarPropuesta(propuesta, tx),
    guardarTextoDeIa: (texto, tx) => generacion.guardarTexto(texto, tx),
    preguntasDeLote: (loteId) => generacion.preguntasDeLote(loteId),
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
