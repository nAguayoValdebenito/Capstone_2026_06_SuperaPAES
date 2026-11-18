// Modo de pruebas de preguntas (MODO_PRUEBAS_PREGUNTAS, apagado por defecto): el administrador publica
// sin revisión hasta 10 borradores por vez, solo para llenar la app de preguntas y probarla. Es una
// excepción a la revisión de dos docentes (RN-10): cada pregunta pasa por las etapas que la base permite
// (borrador → en revisión → aprobada → publicada), con la dificultad sugerida como asignada (o media si
// no tiene), y queda en la auditoría como «publicar_sin_revision» a nombre del administrador. Se retira
// desde el banco como cualquier publicada. La ruta solo se monta con el modo encendido.
import { ErrorAplicacion, ErrorConflicto, ErrorNoEncontrado } from '../../comun/errores.js';
import type { UnidadDeTrabajo } from '../../db/transaccion.js';
import type { AdministracionServicio } from '../administracion/index.js';
import type { PreguntasEdicionRepositorio } from './preguntas.edicion.repositorio.js';
import { traducirErrores } from './preguntas.edicion.servicio.js';
import type { PublicacionRepositorio } from './preguntas.publicacion.repositorio.js';
import { MAXIMO_LOTE_PREGUNTAS } from './preguntas.validadores.js';

/** Por qué no se publicó una pregunta del lote. */
export interface PreguntaNoPublicada {
  id: string;
  motivo: string;
}

export interface PublicacionSinRevision {
  publicadas: string[];
  noPublicadas: PreguntaNoPublicada[];
}

export interface SinRevisionPreguntas {
  /**
   * Publica sin revisión las preguntas en borrador del lote (hasta 10), cada una en su transacción: si
   * una no se puede (no está en borrador, le falta la alternativa correcta...), sigue con las demás y
   * dice por qué.
   */
  publicarSinRevision(
    administradorId: string,
    ids: readonly string[],
  ): Promise<PublicacionSinRevision>;
}

/** Lo mismo que usa publicar una pregunta (preguntas.publicacion.servicio.ts). */
export interface DependenciasSinRevision {
  unidadDeTrabajo: UnidadDeTrabajo;
  auditoria: Pick<AdministracionServicio, 'registrarAuditoria'>;
  autor: Pick<PreguntasEdicionRepositorio, 'fijarAutor'>;
  repositorio: PublicacionRepositorio;
}

/** Las etapas por las que pasa, en el orden que permite la base. */
const ETAPAS = ['en_revision', 'aprobada', 'publicada'] as const;

/** Publica una pregunta en borrador; lanza el error de la regla que no cumple. */
async function publicarUna(
  { unidadDeTrabajo, auditoria, autor, repositorio }: DependenciasSinRevision,
  administradorId: string,
  id: string,
): Promise<void> {
  await unidadDeTrabajo.enTransaccion(async (tx) => {
    await autor.fijarAutor(administradorId, tx);
    const actual = await repositorio.reservar(id, tx);
    if (!actual) throw new ErrorNoEncontrado('La pregunta no existe.');
    if (actual.estado.codigo !== 'borrador') {
      throw new ErrorConflicto(
        `La pregunta está «${actual.estado.nombre}»: solo se publican sin revisión las que están en borrador.`,
      );
    }
    await repositorio.asignarDificultadSugerida(id, tx);
    for (const etapa of ETAPAS) {
      await traducirErrores(() => repositorio.cambiarEtapa(id, etapa, tx));
    }
    await auditoria.registrarAuditoria(
      {
        usuarioId: administradorId,
        accion: 'publicar_sin_revision',
        entidad: 'pregunta',
        entidadId: id,
        antes: { estado: 'borrador' },
        despues: { estado: 'publicada', modoPruebas: true },
      },
      tx,
    );
  });
}

/** El motivo de una regla del sistema; un error inesperado se vuelve a lanzar. */
function motivoDe(error: unknown): string {
  if (error instanceof ErrorAplicacion) return error.message;
  throw error;
}

export function crearSinRevisionPreguntas(
  dependencias: DependenciasSinRevision,
): SinRevisionPreguntas {
  return {
    async publicarSinRevision(administradorId, ids) {
      const resultado: PublicacionSinRevision = { publicadas: [], noPublicadas: [] };
      // De a una, en orden: cada pregunta es independiente y el lote es chico (hasta 10).
      for (const id of ids.slice(0, MAXIMO_LOTE_PREGUNTAS)) {
        try {
          await publicarUna(dependencias, administradorId, id);
          resultado.publicadas.push(id);
        } catch (error) {
          resultado.noPublicadas.push({ id, motivo: motivoDe(error) });
        }
      }
      return resultado;
    },
  };
}
