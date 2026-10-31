// Lo que la app del estudiante hace con su cuenta además del registro, la sesión y el perfil: el estado
// del inicio (HU-35.1), los puntajes PAES declarados (HU-41.1), la cuenta para descargar sus datos
// (HU-07.1) y el borrado de la cuenta (HU-08.1). cuentas.servicio.ts lo expone en su servicio.
import { ErrorNoEncontrado } from '../../comun/errores.js';
import { crearEliminacionRepositorio } from './cuentas.eliminacion.repositorio.js';
import {
  type ConsentimientoExportado,
  crearExportacionRepositorio,
  type CuentaExportada,
} from './cuentas.exportacion.repositorio.js';
import {
  crearEstadoCuentaApp,
  type DependenciasEstadoCuenta,
  type EstadoCuentaApp,
} from './cuentas.estado.servicio.js';
import { crearInicioCuenta, type InicioCuenta } from './cuentas.inicio.servicio.js';
import { crearPuntajes, type EntradaPuntajes, type Puntajes } from './cuentas.puntajes.servicio.js';

export interface ExportacionCuenta {
  /**
   * HU-07.1 (RF-A18): la cuenta, sin la contraseña, y cada documento legal que aceptó o retiró. Cuenta
   * eliminada: 404. El perfil y los puntajes se piden aparte (obtenerPerfil y obtenerPuntajes).
   */
  exportarCuenta(estudianteId: string): Promise<{
    cuenta: CuentaExportada;
    consentimientos: ConsentimientoExportado[];
  }>;
}

export interface EliminacionCuenta {
  /**
   * HU-08.1 (RF-A18, RNF-09, CU-14 paso 6): elimina el perfil y los puntajes, reemplaza el nombre, el
   * correo y la contraseña, revoca las sesiones y retira los permisos. Las evaluaciones, las respuestas
   * y el historial de la suscripción quedan seudonimizados. Cuenta inexistente o ya eliminada: 404.
   */
  eliminarCuenta(estudianteId: string): Promise<{ eliminadaEn: Date }>;
}

export type CuentaEnLaApp = InicioCuenta &
  Puntajes &
  ExportacionCuenta &
  EliminacionCuenta &
  EstadoCuentaApp;

export function crearCuentaEnLaApp(
  entrada: EntradaPuntajes & Pick<DependenciasEstadoCuenta, 'cupoInvitaciones'>,
): CuentaEnLaApp {
  const exportacion = crearExportacionRepositorio(entrada.bd);
  const eliminacion = crearEliminacionRepositorio();
  const exportarCuenta: ExportacionCuenta['exportarCuenta'] = async (estudianteId) => {
    const cuenta = await exportacion.cuenta(estudianteId);
    if (!cuenta) throw new ErrorNoEncontrado('La cuenta no existe.');
    return { cuenta, consentimientos: await exportacion.consentimientos(estudianteId) };
  };
  return {
    ...crearInicioCuenta(entrada.bd),
    ...crearPuntajes(entrada),
    exportarCuenta,
    ...crearEstadoCuentaApp({ exportarCuenta, cupoInvitaciones: entrada.cupoInvitaciones }),
    eliminarCuenta: (estudianteId) =>
      entrada.unidadDeTrabajo.enTransaccion(async (tx) => {
        const eliminadaEn = entrada.reloj();
        if (!(await eliminacion.eliminar(estudianteId, eliminadaEn, tx)))
          throw new ErrorNoEncontrado('La cuenta no existe.');
        return { eliminadaEn };
      }),
  };
}
