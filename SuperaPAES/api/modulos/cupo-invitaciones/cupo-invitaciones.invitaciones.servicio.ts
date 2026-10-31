// HU-46.1 (RF-A12, CU-11 paso 2, RN-33): el código propio del estudiante, su link a la página de
// invitación de la consola y cuántos se registraron con él y cuántos verificaron su correo (A38). El
// bono por invitado (RN-03) llega con HU-47.1.
import { ErrorNoEncontrado } from '../../comun/errores.js';
import type { CupoInvitacionesRepositorio } from './cupo-invitaciones.repositorio.js';

/** El código de invitación es de la cuenta (módulo cuentas). */
export interface CuentaParaInvitar {
  /** null si la cuenta no existe o se eliminó. */
  codigoInvitacion(estudianteId: string): Promise<string | null>;
}

export interface ResumenInvitaciones {
  /** 6 caracteres, sin 0, O, 1 ni I (RN-33). */
  codigo: string;
  /** «dirección de la consola»/invitar/«código» (W01 y W02). */
  link: string;
  /** Se registraron con su código. */
  registrados: number;
  /** De esos, los que ya verificaron su correo. */
  verificados: number;
}

export interface Invitaciones {
  misInvitaciones(estudianteId: string): Promise<ResumenInvitaciones>;
}

export interface DependenciasInvitaciones {
  repositorio: Pick<CupoInvitacionesRepositorio, 'contarInvitaciones'>;
  cuentas: CuentaParaInvitar;
  /** Dirección pública de la consola, sin la barra final. */
  urlConsola: string;
}

export function crearInvitaciones(dependencias: DependenciasInvitaciones): Invitaciones {
  const { repositorio, cuentas, urlConsola } = dependencias;
  return {
    async misInvitaciones(estudianteId) {
      const codigo = await cuentas.codigoInvitacion(estudianteId);
      if (!codigo) throw new ErrorNoEncontrado('La cuenta no existe.');
      const { registrados, verificados } = await repositorio.contarInvitaciones(estudianteId);
      return { codigo, link: `${urlConsola}/invitar/${codigo}`, registrados, verificados };
    },
  };
}
