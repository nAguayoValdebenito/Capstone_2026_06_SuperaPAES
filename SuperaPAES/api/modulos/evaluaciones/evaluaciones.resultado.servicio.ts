// HU-61.1: resultado y revisión pregunta por pregunta de cualquier evaluación cerrada del estudiante
// (práctica, repaso, diagnóstico, mini-ensayo y ensayo completo; A30 a A33). Como el resumen de la
// práctica, no depende del cupo. Una evaluación con tiempo vencida y sin cerrar se cierra al
// consultarla (RN-21).
import type { Ejecutor, UnidadDeTrabajo } from '../../db/transaccion.js';
import { evaluacionInexistente, evaluacionSinEntregar } from './evaluaciones.errores.js';
import type { ResultadoRepositorio } from './evaluaciones.resultado.repositorio.js';
import type { ProgresoServicio } from './evaluaciones.progreso.servicio.js';
import { conTransaccionDeCierre } from './evaluaciones.cierre-transaccion.js';

export interface DependenciasResultado {
  repositorio: ResultadoRepositorio;
  unidadDeTrabajo: UnidadDeTrabajo;
  progreso: Pick<ProgresoServicio, 'obtenerProgreso'>;
}

async function consultarCerrada<T>(
  { repositorio, unidadDeTrabajo }: DependenciasResultado,
  estudianteId: string,
  id: string,
  leer: (tx: Ejecutor) => Promise<T>,
): Promise<T> {
  return conTransaccionDeCierre(unidadDeTrabajo, async (tx) => {
    const evaluacion = await repositorio.bloquearEvaluacion(id, estudianteId, tx);
    if (!evaluacion) throw evaluacionInexistente();
    if (!evaluacion.cerradaEn) {
      if (!evaluacion.vencida) throw evaluacionSinEntregar();
      await repositorio.cerrarPorTiempo(id, tx);
    }
    return leer(tx);
  });
}

export function crearResultadoServicio(dependencias: DependenciasResultado) {
  const { repositorio, progreso } = dependencias;
  return {
    obtenerResultado: async (estudianteId: string, id: string) => {
      const resultado = await consultarCerrada(dependencias, estudianteId, id, async (tx) => {
        const resultado = await repositorio.leerResultado(id, estudianteId, tx);
        if (!resultado) throw new Error('La evaluación cerrada no tiene un resultado guardado.');
        return resultado;
      });
      if (resultado.tipo.codigo !== 'diagnostico') return resultado;
      const prueba = (await progreso.obtenerProgreso(estudianteId)).pruebas.find(
        (p) => p.pruebaId === resultado.prueba.id,
      );
      const ejes = resultado.ejes.map((eje) => ({
        ...eje,
        aReforzar: prueba?.ejes.find((p) => p.id === eje.id)?.aReforzar ?? false,
      }));
      const habilidades = resultado.habilidades.map((habilidad) => ({
        ...habilidad,
        aReforzar: prueba?.habilidades.find((p) => p.id === habilidad.id)?.aReforzar ?? false,
      }));
      return {
        ...resultado,
        ejes,
        habilidades,
        ejesAReforzar: ejes.filter((eje) => eje.aReforzar).map((eje) => eje.id),
        habilidadesAReforzar: habilidades
          .filter((habilidad) => habilidad.aReforzar)
          .map((habilidad) => habilidad.id),
      };
    },
    obtenerRevision: (estudianteId: string, id: string) =>
      consultarCerrada(dependencias, estudianteId, id, async (tx) => ({
        id,
        preguntas: await repositorio.leerRevision(id, estudianteId, tx),
      })),
  };
}

export type ResultadoServicio = ReturnType<typeof crearResultadoServicio>;
