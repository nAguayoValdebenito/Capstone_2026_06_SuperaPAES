// HU-60.1 (CU-28, RF-A22): la evaluación sin terminar que el estudiante puede retomar donde quedó, con
// sus respuestas guardadas; con tiempo, el reloj siguió corriendo. Si al consultarla ya venció (RN-21)
// o es una práctica sin actividad (RN-19), se cierra ahí mismo y se informa cuál se cerró. La tarea
// periódica cierra las demás con cerrarVencidas.
import type { UnidadDeTrabajo } from '../../db/transaccion.js';
import type { AdministracionServicio } from '../administracion/index.js';
import { crearConTiempoRepositorio } from './evaluaciones.con-tiempo.repositorio.js';
import { conTransaccionDeCierre } from './evaluaciones.cierre-transaccion.js';
import type {
  AbiertaRepositorio,
  EvaluacionParaRetomar,
} from './evaluaciones.abierta.repositorio.js';

export interface DependenciasAbierta {
  repositorio: AbiertaRepositorio;
  unidadDeTrabajo: UnidadDeTrabajo;
  administracion: Pick<AdministracionServicio, 'obtenerParametroEntero'>;
}

/** La que se cerró al consultarla: la app puede ofrecer su resultado. */
export interface EvaluacionRecienCerrada {
  id: string;
  tipo: EvaluacionParaRetomar['tipo'];
  estado: 'tiempo_agotado' | 'abandonada';
}

export interface EvaluacionAbierta {
  abierta: EvaluacionParaRetomar | null;
  cerrada: EvaluacionRecienCerrada | null;
}

export function crearAbiertaServicio(dependencias: DependenciasAbierta) {
  const { repositorio, unidadDeTrabajo, administracion } = dependencias;
  return {
    async evaluacionAbierta(estudianteId: string): Promise<EvaluacionAbierta> {
      const horas = await administracion.obtenerParametroEntero('horas_inactividad_practica');
      return conTransaccionDeCierre(unidadDeTrabajo, async (tx) => {
        const fila = await repositorio.leerAbierta(estudianteId, horas, tx);
        if (!fila) return { abierta: null, cerrada: null };
        const { vencida, inactiva, ...abierta } = fila;
        if (!vencida && !inactiva) {
          if (abierta.venceEn)
            abierta.preguntas = await crearConTiempoRepositorio().preguntas(
              abierta.id,
              estudianteId,
              tx,
            );
          return { abierta, cerrada: null };
        }
        const estado = vencida ? 'tiempo_agotado' : 'abandonada';
        await repositorio.cerrar(fila.id, estado, tx);
        return { abierta: null, cerrada: { id: fila.id, tipo: fila.tipo, estado } };
      });
    },
    /** Tarea periódica (DAS 4.3.3): cuántas evaluaciones cerró app.cerrar_vencidas. */
    cerrarVencidas: () => repositorio.cerrarVencidas(),
  };
}

export type AbiertaServicio = ReturnType<typeof crearAbiertaServicio>;
