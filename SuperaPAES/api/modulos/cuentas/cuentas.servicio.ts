// Reglas de negocio del módulo cuentas: registro, ingreso, verificación de correo y recuperación de
// contraseña de estudiantes, consentimientos, pruebas elegidas, puntajes PAES declarados e ingreso
// del personal interno.
// Es la única puerta de entrada al módulo: los demás módulos usan este servicio, nunca su repositorio.
import type { ProveedorCorreo } from '../../adaptadores/fabrica.js';
import { ErrorNoImplementado } from '../../comun/errores.js';
import type { Ejecutor, UnidadDeTrabajo } from '../../db/transaccion.js';
import type { AdministracionServicio } from '../administracion/index.js';
import type { CuentasRepositorio } from './cuentas.repositorio.js';
import type { Credenciales, DatosRegistro } from './cuentas.validadores.js';

export interface DependenciasCuentasServicio {
  bd: Ejecutor;
  unidadDeTrabajo: UnidadDeTrabajo;
  correo: ProveedorCorreo;
  administracion: AdministracionServicio;
  /** Solo para pruebas: reemplaza al repositorio que se crea con crearCuentasRepositorio(bd). */
  repositorio?: CuentasRepositorio;
}

export interface SesionIniciada {
  tokenAcceso: string;
  tokenRenovacion: string;
}

export interface CuentasServicio {
  registrarEstudiante(datos: DatosRegistro): Promise<SesionIniciada>;
  ingresarEstudiante(credenciales: Credenciales): Promise<SesionIniciada>;
  solicitarRecuperacion(correo: string): Promise<void>;
  ingresarUsuarioInterno(credenciales: Credenciales): Promise<SesionIniciada>;
}

// Esqueleto: cada método se implementa en la historia de usuario correspondiente.
export function crearCuentasServicio(_dependencias: DependenciasCuentasServicio): CuentasServicio {
  return {
    registrarEstudiante: () =>
      Promise.reject(new ErrorNoImplementado('El registro de estudiantes')),
    ingresarEstudiante: () => Promise.reject(new ErrorNoImplementado('El ingreso de estudiantes')),
    solicitarRecuperacion: () =>
      Promise.reject(new ErrorNoImplementado('La recuperación de contraseña')),
    ingresarUsuarioInterno: () =>
      Promise.reject(new ErrorNoImplementado('El ingreso a la consola')),
  };
}
