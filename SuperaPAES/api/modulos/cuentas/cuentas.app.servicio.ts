// Lo que la app del estudiante lee de su cuenta además del registro, la sesión y el perfil: el estado
// del inicio (HU-35.1), los puntajes PAES declarados (HU-41.1) y la cuenta para descargar sus datos
// (HU-07.1). cuentas.servicio.ts lo expone en su servicio.
import { ErrorNoEncontrado } from '../../comun/errores.js';
import {
  type ConsentimientoExportado,
  crearExportacionRepositorio,
  type CuentaExportada,
} from './cuentas.exportacion.repositorio.js';
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

export type CuentaEnLaApp = InicioCuenta & Puntajes & ExportacionCuenta;

export function crearCuentaEnLaApp(entrada: EntradaPuntajes): CuentaEnLaApp {
  const exportacion = crearExportacionRepositorio(entrada.bd);
  return {
    ...crearInicioCuenta(entrada.bd),
    ...crearPuntajes(entrada),
    exportarCuenta: async (estudianteId) => {
      const cuenta = await exportacion.cuenta(estudianteId);
      if (!cuenta) throw new ErrorNoEncontrado('La cuenta no existe.');
      return { cuenta, consentimientos: await exportacion.consentimientos(estudianteId) };
    },
  };
}
