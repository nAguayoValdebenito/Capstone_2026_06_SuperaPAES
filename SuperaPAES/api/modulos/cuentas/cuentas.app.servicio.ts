// Lo que la app del estudiante lee de su cuenta además del registro, la sesión y el perfil: el estado
// del inicio (HU-35.1) y los puntajes PAES declarados (HU-41.1). cuentas.servicio.ts lo expone en su
// servicio.
import { crearInicioCuenta, type InicioCuenta } from './cuentas.inicio.servicio.js';
import { crearPuntajes, type EntradaPuntajes, type Puntajes } from './cuentas.puntajes.servicio.js';

export type CuentaEnLaApp = InicioCuenta & Puntajes;

export function crearCuentaEnLaApp(entrada: EntradaPuntajes): CuentaEnLaApp {
  return { ...crearInicioCuenta(entrada.bd), ...crearPuntajes(entrada) };
}
