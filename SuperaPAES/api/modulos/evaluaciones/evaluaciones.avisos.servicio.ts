// HU-37 (RF-A16, CU-13, A23): el estudiante avisa un error en una pregunta que recibió. Este módulo es
// dueño del ítem: comprueba que es de una evaluación del estudiante y toma la versión que vio
// (decisiones D1 a D3 de docs/planes/hu-37-avisar-error.md). Preguntas aplica los límites y guarda el
// aviso, en la misma transacción.
import { ErrorConflicto, ErrorNoEncontrado } from '../../comun/errores.js';
import type { UnidadDeTrabajo } from '../../db/transaccion.js';
import type { PreguntasServicio } from '../preguntas/index.js';
import type { AvisosItemRepositorio } from './evaluaciones.avisos.repositorio.js';
import type { DatosAviso } from './evaluaciones.validadores.js';

type AvisoRegistrado = Awaited<ReturnType<PreguntasServicio['registrarAvisoDeEstudiante']>>;

export interface AvisoDeItem extends DatosAviso {
  evaluacionId: string;
  itemId: string;
}

export interface AvisosServicio {
  /** 404 si el ítem no es del estudiante; 409 si ya se anuló; los demás errores, de preguntas. */
  avisarError(estudianteId: string, aviso: AvisoDeItem): Promise<AvisoRegistrado>;
}

export function crearAvisosServicio(dependencias: {
  unidadDeTrabajo: UnidadDeTrabajo;
  preguntas: Pick<PreguntasServicio, 'registrarAvisoDeEstudiante'>;
  repositorio: AvisosItemRepositorio;
}): AvisosServicio {
  const { unidadDeTrabajo, preguntas, repositorio } = dependencias;
  return {
    avisarError: (estudianteId, { evaluacionId, itemId, motivo, comentario }) =>
      unidadDeTrabajo.enTransaccion(async (tx) => {
        const item = await repositorio.itemDelEstudiante([evaluacionId, itemId, estudianteId], tx);
        if (!item) throw new ErrorNoEncontrado('La pregunta no existe.');
        if (item.anulada) throw new ErrorConflicto('Esta pregunta ya se anuló por un error.');
        return preguntas.registrarAvisoDeEstudiante(
          { estudianteId, preguntaId: item.preguntaId, version: item.version, motivo, comentario },
          tx,
        );
      }),
  };
}
