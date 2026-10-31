import type { UnidadDeTrabajo } from '../../db/transaccion.js';
import type { CuentasServicio } from '../cuentas/index.js';
import { crearCierreRepositorio } from './evaluaciones.cierre.repositorio.js';
import { evaluacionInexistente } from './evaluaciones.errores.js';
import { conTransaccionDeCierre } from './evaluaciones.cierre-transaccion.js';

export function crearEntregaServicio(
  unidadDeTrabajo: UnidadDeTrabajo,
  cuentas: Pick<CuentasServicio, 'estadoParaCupo'>,
) {
  const repositorio = crearCierreRepositorio();
  return {
    entregarEvaluacion: (estudianteId: string, id: string) =>
      conTransaccionDeCierre(unidadDeTrabajo, async (tx) => {
        if (!(await cuentas.estadoParaCupo(estudianteId, tx, true))) throw evaluacionInexistente();
        const evaluacion = await repositorio.bloquear(id, estudianteId, tx);
        if (!evaluacion) throw evaluacionInexistente();
        let estado = evaluacion.estado;
        if (!evaluacion.cerradaEn) {
          estado = await repositorio.cerrar(id, 'entregada', tx);
        }
        return { id, estado, resultadoDisponible: true };
      }),
  };
}
export type EntregaServicio = ReturnType<typeof crearEntregaServicio>;
