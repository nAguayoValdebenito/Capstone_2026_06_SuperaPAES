// Publicar, retirar y volver a borrador una pregunta (HU-24, CU-21, C02, RF-G09, RF-G10, RN-13): solo se
// publica una pregunta aprobada y con la dificultad que asignaron los docentes (lo revisa la base, como
// la explicación de cada alternativa en las de la IA); solo se retira una
// publicada, que deja de llegar a la app; y una retirada vuelve a borrador para corregirla y enviarla a
// una nueva revisión. Publicar y retirar quedan en la auditoría con quién lo hizo (HU-24 esc. 3); cada
// cambio de etapa queda además en el historial de la pregunta.
import { ErrorConflicto, ErrorNoEncontrado } from '../../comun/errores.js';
import type { UnidadDeTrabajo } from '../../db/transaccion.js';
import type { AdministracionServicio } from '../administracion/index.js';
import type { PreguntasEdicionRepositorio } from './preguntas.edicion.repositorio.js';
import { traducirErrores } from './preguntas.edicion.servicio.js';
import type { PublicacionRepositorio } from './preguntas.publicacion.repositorio.js';
import type { Opcion } from './preguntas.repositorio.js';

/** Publicar (aprobada → publicada), retirar (publicada → retirada) o volver a borrador (retirada → borrador). */
export type CambioDeEtapa = 'publicar' | 'retirar' | 'borrador';

/** La pregunta con la etapa en que quedó. */
export interface PreguntaConEtapa {
  id: string;
  estado: Opcion;
}

export interface PublicacionPreguntas {
  /** 404 si la pregunta no existe; 409 si no está en la etapa que pide el cambio. */
  cambiarEtapa(
    administradorId: string,
    id: string,
    cambio: CambioDeEtapa,
  ): Promise<PreguntaConEtapa>;
}

export interface DependenciasPublicacion {
  unidadDeTrabajo: UnidadDeTrabajo;
  auditoria: Pick<AdministracionServicio, 'registrarAuditoria'>;
  /** Fija quién hace el cambio, para el historial de la pregunta. */
  autor: Pick<PreguntasEdicionRepositorio, 'fijarAutor'>;
  repositorio: PublicacionRepositorio;
}

interface Regla {
  desde: string;
  hacia: string;
  /** La acción de la auditoría; volver a borrador queda solo en el historial. */
  accion: string | null;
  motivo: string;
}

const REGLAS: Record<CambioDeEtapa, Regla> = {
  publicar: {
    desde: 'aprobada',
    hacia: 'publicada',
    accion: 'publicar_pregunta',
    motivo: 'solo se publican preguntas aprobadas.',
  },
  retirar: {
    desde: 'publicada',
    hacia: 'retirada',
    accion: 'retirar_pregunta',
    motivo: 'solo se retiran preguntas publicadas.',
  },
  borrador: {
    desde: 'retirada',
    hacia: 'borrador',
    accion: null,
    motivo: 'solo vuelven a borrador las preguntas retiradas.',
  },
};

async function cambiarEtapa(
  { unidadDeTrabajo, auditoria, autor, repositorio }: DependenciasPublicacion,
  administradorId: string,
  [id, cambio]: [string, CambioDeEtapa],
): Promise<PreguntaConEtapa> {
  const regla = REGLAS[cambio];
  return unidadDeTrabajo.enTransaccion(async (tx) => {
    await autor.fijarAutor(administradorId, tx);
    const actual = await repositorio.reservar(id, tx);
    if (!actual) throw new ErrorNoEncontrado('La pregunta no existe.');
    if (actual.estado.codigo !== regla.desde) {
      throw new ErrorConflicto(`La pregunta está «${actual.estado.nombre}»: ${regla.motivo}`);
    }
    const estado = await traducirErrores(() => repositorio.cambiarEtapa(id, regla.hacia, tx));
    if (regla.accion) {
      await auditoria.registrarAuditoria(
        {
          usuarioId: administradorId,
          accion: regla.accion,
          entidad: 'pregunta',
          entidadId: id,
          antes: { estado: actual.estado.codigo },
          despues: { estado: estado.codigo },
        },
        tx,
      );
    }
    return { id, estado };
  });
}

export function crearPublicacionPreguntas(
  dependencias: DependenciasPublicacion,
): PublicacionPreguntas {
  return {
    cambiarEtapa: (administradorId, id, cambio) =>
      cambiarEtapa(dependencias, administradorId, [id, cambio]),
  };
}
