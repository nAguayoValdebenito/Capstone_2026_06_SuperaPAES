import type { UnidadDeTrabajo } from '../../db/transaccion.js';
import type { CuentasServicio } from '../cuentas/index.js';
import { crearCierreRepositorio } from './evaluaciones.cierre.repositorio.js';
import { evaluacionInexistente } from './evaluaciones.errores.js';

export function crearEntregaServicio(
  unidadDeTrabajo: UnidadDeTrabajo,
  cuentas: Pick<CuentasServicio, 'estadoParaCupo'>,
) {
  const repositorio = crearCierreRepositorio();
  return {
    entregarEvaluacion: (estudianteId: string, id: string) =>
      unidadDeTrabajo.enTransaccion(async (tx) => {
        if (!(await cuentas.estadoParaCupo(estudianteId, tx, true))) throw evaluacionInexistente();
        const evaluacion = await repositorio.bloquear(id, estudianteId, tx);
        if (!evaluacion) throw evaluacionInexistente();
        let estado = evaluacion.estado;
        if (!evaluacion.cerradaEn) {
          const { ahora } = await repositorio.reloj(tx);
          estado = ahora >= evaluacion.venceEn ? 'tiempo_agotado' : 'entregada';
          await repositorio.cerrar(id, estado, tx);
        }
        return { id, estado, resultadoDisponible: true };
      }),
  };
}
export type EntregaServicio = ReturnType<typeof crearEntregaServicio>;
