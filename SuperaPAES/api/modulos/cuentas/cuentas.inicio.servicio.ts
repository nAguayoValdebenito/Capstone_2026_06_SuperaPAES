// HU-35.1 (RF-A05): lo que el inicio de la app necesita de la cuenta. Lo pide cupo-invitaciones, que
// arma el inicio con el cupo del día.
import type { Ejecutor } from '../../db/transaccion.js';
import { crearInicioRepositorio, type EstadoCuentaInicio } from './cuentas.inicio.repositorio.js';

export interface InicioCuenta {
  /**
   * Si el correo está verificado y la racha que se muestra en el día de Chile de `ahora`. null si la
   * cuenta no existe o se eliminó.
   */
  estadoParaInicio(estudianteId: string, ahora: Date): Promise<EstadoCuentaInicio | null>;
}

export function crearInicioCuenta(bd: Ejecutor): InicioCuenta {
  const repositorio = crearInicioRepositorio(bd);
  return { estadoParaInicio: (id, ahora) => repositorio.estadoParaInicio(id, ahora) };
}
