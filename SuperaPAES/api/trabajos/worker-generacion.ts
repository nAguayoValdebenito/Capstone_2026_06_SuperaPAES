// Worker de la cola de generación con IA (productor-consumidor sobre contenido.lote_generacion).
// Corre en el mismo proceso que la API y llama periódicamente al servicio del generador.
// Es el primer candidato a separarse en su propio proceso si algún día hace falta.
import { mensajeDeError, registro } from '../comun/registro.js';
import type { GeneradorServicio } from '../modulos/generador/index.js';

export interface WorkerGeneracion {
  iniciar(): void;
  /** Deja de programar vueltas y espera a que termine la que está en curso. */
  detener(): Promise<void>;
}

export function crearWorkerGeneracion(
  generador: Pick<GeneradorServicio, 'procesarPendientes'>,
  intervaloMs = 10_000,
): WorkerGeneracion {
  let temporizador: NodeJS.Timeout | undefined;
  let enCurso: Promise<void> = Promise.resolve();
  let activo = false;

  const vuelta = async () => {
    try {
      const procesados = await generador.procesarPendientes();
      if (procesados > 0) registro.info('Lotes de generación procesados', { procesados });
    } catch (error) {
      registro.error('Falló el worker de generación', {
        error: mensajeDeError(error),
      });
    }
  };

  const programar = () => {
    if (!activo) return;
    temporizador = setTimeout(() => {
      enCurso = vuelta().finally(programar);
    }, intervaloMs);
    // El temporizador no impide que el proceso termine.
    temporizador.unref();
  };

  return {
    iniciar() {
      if (activo) return;
      activo = true;
      programar();
    },
    async detener() {
      activo = false;
      clearTimeout(temporizador);
      await enCurso;
    },
  };
}
