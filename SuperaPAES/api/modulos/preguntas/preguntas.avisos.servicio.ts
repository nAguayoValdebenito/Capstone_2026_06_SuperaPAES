// Avisos de error de los estudiantes (HU-50.1, RF-C08, CU-26, C13). Esc. 1: la bandeja muestra los
// avisos, agrupados por pregunta, con acceso a la pregunta. Esc. 2: el administrador cierra un aviso
// como resuelto o descartado; se cierra solo ese aviso (decisión D3 de docs/planes/hu-50-avisos-error.md:
// el DAS no dice que se cierren los demás de la misma pregunta). El cierre guarda quién y cuándo, y queda
// en la auditoría (atender_reporte) en la misma transacción.
import { ErrorConflicto, ErrorNoEncontrado, ErrorValidacion } from '../../comun/errores.js';
import type { Paginacion } from '../../comun/respuesta.js';
import type { Ejecutor, UnidadDeTrabajo } from '../../db/transaccion.js';
import type { AdministracionServicio } from '../administracion/index.js';
import type { PruebaTemario, TemarioServicio } from '../temario/index.js';
import {
  crearAvisosRepositorio,
  type AvisosRepositorio,
  type FilaAviso,
  type FilaGrupoAvisos,
} from './preguntas.avisos.repositorio.js';
import type { Opcion } from './preguntas.repositorio.js';
import type { CierreAviso, FiltrosAvisos } from './preguntas.validadores.js';

/** Un aviso en la bandeja, con las fechas en ISO. */
export interface AvisoDeError {
  id: string;
  version: number;
  motivo: Opcion;
  comentario: string;
  estado: Opcion;
  creadoEn: string;
  resueltoEn: string | null;
  resueltoPor: string | null;
}

/** Una pregunta de la bandeja con sus avisos (C13). */
export interface GrupoDeAvisos {
  pregunta: {
    id: string;
    versionActual: number;
    estado: Opcion;
    prueba: { id: number; codigo: string; nombre: string };
    contenido: { id: number; nombre: string };
    resumen: string;
  };
  pendientes: number;
  avisos: AvisoDeError[];
}

export interface PaginaDeAvisos {
  grupos: GrupoDeAvisos[];
  paginacion: Paginacion;
}

export interface AvisosDeError {
  /** HU-50 esc. 1: la bandeja paginada por pregunta. 400 si el motivo no existe. */
  listarAvisos(filtros: FiltrosAvisos): Promise<PaginaDeAvisos>;
  /** HU-50 esc. 2: 404 si el aviso no existe; 409 si ya está cerrado. */
  cerrarAviso(administradorId: string, id: string, estado: CierreAviso): Promise<AvisoDeError>;
}

/** Lo que recibe el servicio de preguntas; `repositorioAvisos` solo lo reemplazan las pruebas. */
interface DependenciasDelModulo {
  bd: Ejecutor;
  unidadDeTrabajo: UnidadDeTrabajo;
  temario: Pick<TemarioServicio, 'listarTemario'>;
  administracion: Pick<AdministracionServicio, 'registrarAuditoria'>;
  repositorioAvisos?: AvisosRepositorio | undefined;
}

interface DependenciasAvisos {
  unidadDeTrabajo: UnidadDeTrabajo;
  temario: Pick<TemarioServicio, 'listarTemario'>;
  auditoria: Pick<AdministracionServicio, 'registrarAuditoria'>;
  repositorio: AvisosRepositorio;
}

type Ubicacion = Pick<GrupoDeAvisos['pregunta'], 'prueba' | 'contenido'>;

/** Prueba y contenido de cada contenido del temario, para nombrar cada pregunta. */
function ubicaciones(pruebas: readonly PruebaTemario[]): Map<number, Ubicacion> {
  const mapa = new Map<number, Ubicacion>();
  for (const { id, codigo, nombre, ejes } of pruebas) {
    for (const contenido of ejes.flatMap((eje) => eje.contenidos)) {
      mapa.set(contenido.id, {
        prueba: { id, codigo, nombre },
        contenido: { id: contenido.id, nombre: contenido.nombre },
      });
    }
  }
  return mapa;
}

const fechaIso = (fecha: string): string => new Date(fecha).toISOString();

function aAviso(fila: FilaAviso): AvisoDeError {
  return {
    ...fila,
    creadoEn: fechaIso(fila.creadoEn),
    resueltoEn: fila.resueltoEn === null ? null : fechaIso(fila.resueltoEn),
  };
}

function aGrupo(fila: FilaGrupoAvisos, mapa: Map<number, Ubicacion>): GrupoDeAvisos {
  const ubicacion = mapa.get(fila.contenidoId);
  // La clave foránea lo garantiza: si falta, el temario no está completo.
  if (!ubicacion)
    throw new Error(`El contenido ${String(fila.contenidoId)} no está en el temario.`);
  return {
    pregunta: {
      id: fila.preguntaId,
      versionActual: fila.versionActual,
      estado: fila.estado,
      ...ubicacion,
      resumen: fila.resumen,
    },
    pendientes: fila.pendientes,
    avisos: fila.avisos.map(aAviso),
  };
}

async function listarAvisos(
  { repositorio, temario }: DependenciasAvisos,
  filtros: FiltrosAvisos,
): Promise<PaginaDeAvisos> {
  if (filtros.motivo !== undefined) {
    const motivos = await repositorio.motivosDeAviso();
    if (!motivos.some((motivo) => motivo.codigo === filtros.motivo)) {
      const mensaje = 'El motivo no existe.';
      throw new ErrorValidacion([{ lugar: 'consulta', ruta: 'motivo', mensaje }], mensaje);
    }
  }
  const { pagina, porPagina } = filtros;
  const { filas, total } = await repositorio.listarAvisos({
    estado: filtros.estado === 'todos' ? null : filtros.estado,
    motivo: filtros.motivo ?? null,
    limite: porPagina,
    desde: (pagina - 1) * porPagina,
  });
  const mapa = ubicaciones(await temario.listarTemario());
  return {
    grupos: filas.map((fila) => aGrupo(fila, mapa)),
    paginacion: { pagina, porPagina, total },
  };
}

async function cerrarAviso(
  { unidadDeTrabajo, auditoria, repositorio }: DependenciasAvisos,
  administradorId: string,
  [id, estado]: [string, CierreAviso],
): Promise<AvisoDeError> {
  return unidadDeTrabajo.enTransaccion(async (tx) => {
    const actual = await repositorio.reservarAviso(id, tx);
    if (!actual) throw new ErrorNoEncontrado('El aviso no existe.');
    if (actual.final) {
      throw new ErrorConflicto(`El aviso ya está «${actual.estado.nombre}».`);
    }
    const cerrado = await repositorio.cerrarAviso(id, [estado, administradorId], tx);
    await auditoria.registrarAuditoria(
      {
        usuarioId: administradorId,
        accion: 'atender_reporte',
        entidad: 'reporte_pregunta',
        entidadId: id,
        antes: { estado: actual.estado.codigo },
        despues: { estado: cerrado.estado.codigo },
      },
      tx,
    );
    return aAviso(cerrado);
  });
}

export function crearAvisosDeError(modulo: DependenciasDelModulo): AvisosDeError {
  const dependencias: DependenciasAvisos = {
    unidadDeTrabajo: modulo.unidadDeTrabajo,
    temario: modulo.temario,
    auditoria: modulo.administracion,
    repositorio: modulo.repositorioAvisos ?? crearAvisosRepositorio(modulo.bd),
  };
  return {
    listarAvisos: (filtros) => listarAvisos(dependencias, filtros),
    cerrarAviso: (administradorId, id, estado) =>
      cerrarAviso(dependencias, administradorId, [id, estado]),
  };
}
