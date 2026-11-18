// Acciones en lote del banco (C02), para llenar la app de preguntas y probarla. Cada clic toma las
// preguntas que cumplen los filtros del banco en todo el banco (no solo en la página), las más antiguas
// primero, y procesa hasta 10; el clic siguiente toma las 10 siguientes, hasta que no quede ninguna.
// Si una no se puede, sigue con las demás (revisa hasta 50 por clic) y dice por qué.
//
// Publicar sin revisión es una excepción a la revisión de dos docentes (RN-10), solo para pruebas: cada
// pregunta pasa por las etapas que permite la base (borrador u observada → en revisión → aprobada →
// publicada; una aprobada solo se publica), con la dificultad sugerida (o media) si los docentes no le
// asignaron una, y queda en la auditoría como «publicar_sin_revision». Se retira desde el banco como
// cualquier publicada.
import { ErrorAplicacion, ErrorConflicto, ErrorNoEncontrado } from '../../comun/errores.js';
import type { UnidadDeTrabajo } from '../../db/transaccion.js';
import type { AdministracionServicio } from '../administracion/index.js';
import type { PreguntasEdicionRepositorio } from './preguntas.edicion.repositorio.js';
import { traducirErrores } from './preguntas.edicion.servicio.js';
import type { FiltroResuelto } from './preguntas.filtros-banco.js';
import type { ConteoDelLote, LoteRepositorio } from './preguntas.lote.repositorio.js';
import type { PublicacionRepositorio } from './preguntas.publicacion.repositorio.js';
import type { FiltrosBanco } from './preguntas.validadores.js';

/** Lo que se procesa en un clic. */
export const MAXIMO_LOTE = 10;
/** Las que se revisan como mucho en un clic, por si algunas no se pueden procesar. */
export const CANDIDATAS_POR_LOTE = 50;

/** Etapas desde las que se envía a revisión (RF-G09) y desde las que se publica sin revisión. */
export const ETAPAS_REVISION = ['borrador', 'observada'] as const;
const ETAPAS_PUBLICAR = ['borrador', 'observada', 'aprobada'] as const;

/** Las etapas por las que pasa cada una hasta publicarse, en el orden que permite la base. */
const CAMINO: Record<string, readonly string[]> = {
  borrador: ['en_revision', 'aprobada', 'publicada'],
  observada: ['en_revision', 'aprobada', 'publicada'],
  aprobada: ['publicada'],
};

/** Por qué no se procesó una pregunta del lote. */
export interface PreguntaNoProcesada {
  id: string;
  motivo: string;
}

export interface PublicacionSinRevision {
  publicadas: string[];
  noPublicadas: PreguntaNoProcesada[];
}

export interface LotePreguntas {
  /** Las preguntas del filtro que se pueden enviar a revisión, las más antiguas primero. */
  elegiblesParaRevision(filtros: FiltrosBanco, limite: number): Promise<string[]>;
  /** Cuántas hay para cada acción con los filtros del banco (para los botones de la consola). */
  contarLote(filtros: FiltrosBanco): Promise<ConteoDelLote>;
  /** Publica sin revisión las 10 siguientes del filtro; dice cuáles no y por qué. */
  publicarSinRevision(
    administradorId: string,
    filtros: FiltrosBanco,
  ): Promise<PublicacionSinRevision>;
}

export interface DependenciasLote {
  unidadDeTrabajo: UnidadDeTrabajo;
  auditoria: Pick<AdministracionServicio, 'registrarAuditoria'>;
  autor: Pick<PreguntasEdicionRepositorio, 'fijarAutor'>;
  repositorio: PublicacionRepositorio;
  lote: LoteRepositorio;
  /** Valida y resuelve los filtros del banco, como la tabla (HU-11). */
  resolver: (filtros: FiltrosBanco) => Promise<FiltroResuelto>;
}

/** El motivo de una regla del sistema; un error inesperado se vuelve a lanzar. */
export function motivoDe(error: unknown): string {
  if (error instanceof ErrorAplicacion) return error.message;
  throw error;
}

/** Publica una pregunta sin revisión; lanza el error de la regla que no cumple. */
async function publicarUna(
  d: DependenciasLote,
  administradorId: string,
  id: string,
): Promise<void> {
  await d.unidadDeTrabajo.enTransaccion(async (tx) => {
    await d.autor.fijarAutor(administradorId, tx);
    const actual = await d.repositorio.reservar(id, tx);
    if (!actual) throw new ErrorNoEncontrado('La pregunta no existe.');
    const camino = CAMINO[actual.estado.codigo];
    if (!camino) throw new ErrorConflicto(`La pregunta ya está «${actual.estado.nombre}».`);
    await d.repositorio.asignarDificultadSugerida(id, tx);
    for (const etapa of camino) {
      await traducirErrores(() => d.repositorio.cambiarEtapa(id, etapa, tx));
    }
    await d.auditoria.registrarAuditoria(
      {
        usuarioId: administradorId,
        accion: 'publicar_sin_revision',
        entidad: 'pregunta',
        entidadId: id,
        antes: { estado: actual.estado.codigo },
        despues: { estado: 'publicada' },
      },
      tx,
    );
  });
}

export function crearLotePreguntas(d: DependenciasLote): LotePreguntas {
  return {
    elegiblesParaRevision: async (filtros, limite) =>
      d.lote.elegibles(await d.resolver(filtros), ETAPAS_REVISION, limite),
    contarLote: async (filtros) =>
      d.lote.contar(await d.resolver(filtros), [ETAPAS_REVISION, ETAPAS_PUBLICAR]),
    async publicarSinRevision(administradorId, filtros) {
      const filtro = await d.resolver(filtros);
      const candidatas = await d.lote.elegibles(filtro, ETAPAS_PUBLICAR, CANDIDATAS_POR_LOTE);
      const resultado: PublicacionSinRevision = { publicadas: [], noPublicadas: [] };
      for (const id of candidatas) {
        if (resultado.publicadas.length === MAXIMO_LOTE) break;
        try {
          await publicarUna(d, administradorId, id);
          resultado.publicadas.push(id);
        } catch (error) {
          resultado.noPublicadas.push({ id, motivo: motivoDe(error) });
        }
      }
      return resultado;
    },
  };
}
