// Anular una pregunta con error (HU-50.2, HU-50 esc. 3, RF-C08, CU-26a, RN-22). Solo se anula una
// pregunta publicada (glosario del DAS: «pregunta publicada con un error comprobado»); así anular dos
// veces da 409 y no vuelve a recalcular, porque la primera la deja retirada. En una sola transacción:
// app.anular_pregunta la retira, marca sus ítems como anulados y recalcula las evaluaciones cerradas
// donde apareció; sus avisos pendientes quedan resueltos y todo queda en la auditoría (anular_pregunta),
// con los avisos cerrados dentro (decisión D5 de docs/planes/hu-50-avisos-error.md).
import { ErrorConflicto, ErrorNoEncontrado } from '../../comun/errores.js';
import type { UnidadDeTrabajo } from '../../db/transaccion.js';
import type { AdministracionServicio } from '../administracion/index.js';
import type { AvisosRepositorio } from './preguntas.avisos.repositorio.js';
import type { Opcion } from './preguntas.repositorio.js';

/** Lo que devuelve la anulación a la consola (C13). */
export interface PreguntaAnulada {
  preguntaId: string;
  estado: Opcion;
  evaluacionesRecalculadas: number;
  avisosCerrados: number;
}

export interface AnulacionPreguntas {
  /** 404 si la pregunta no existe; 409 si no está publicada. Irreversible. */
  anularPregunta(administradorId: string, id: string): Promise<PreguntaAnulada>;
}

export interface DependenciasAnulacion {
  unidadDeTrabajo: UnidadDeTrabajo;
  auditoria: Pick<AdministracionServicio, 'registrarAuditoria'>;
  repositorio: Pick<
    AvisosRepositorio,
    'reservarPregunta' | 'anularPregunta' | 'resolverPendientes'
  >;
}

async function anularPregunta(
  { unidadDeTrabajo, auditoria, repositorio }: DependenciasAnulacion,
  administradorId: string,
  id: string,
): Promise<PreguntaAnulada> {
  return unidadDeTrabajo.enTransaccion(async (tx) => {
    const actual = await repositorio.reservarPregunta(id, tx);
    if (!actual) throw new ErrorNoEncontrado('La pregunta no existe.');
    if (actual.codigo !== 'publicada') {
      throw new ErrorConflicto(
        `La pregunta está «${actual.nombre}»: solo se anulan preguntas publicadas.`,
      );
    }
    const { recalculadas, estado } = await repositorio.anularPregunta(id, administradorId, tx);
    const avisos = await repositorio.resolverPendientes(id, administradorId, tx);
    await auditoria.registrarAuditoria(
      {
        usuarioId: administradorId,
        accion: 'anular_pregunta',
        entidad: 'pregunta',
        entidadId: id,
        antes: { estado: actual.codigo },
        despues: {
          estado: estado.codigo,
          evaluacionesRecalculadas: recalculadas,
          avisosCerrados: avisos,
        },
      },
      tx,
    );
    return {
      preguntaId: id,
      estado,
      evaluacionesRecalculadas: recalculadas,
      avisosCerrados: avisos.length,
    };
  });
}

export function crearAnulacionPreguntas(dependencias: DependenciasAnulacion): AnulacionPreguntas {
  return {
    anularPregunta: (administradorId, id) => anularPregunta(dependencias, administradorId, id),
  };
}
