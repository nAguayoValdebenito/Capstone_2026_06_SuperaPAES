// HU-46.1 y HU-47.1 (RF-A12, CU-11 paso 2, RN-03, RN-33): el código propio del estudiante, su link a la
// página de invitación de la consola, cuántos se registraron con él y cuántos verificaron su correo, y lo
// que ganó invitando: preguntas extra, saldo y las invitaciones premiadas del mes con su tope (A38).
import { ErrorNoEncontrado } from '../../comun/errores.js';
import type { Reloj } from '../../comun/reloj.js';
import type { AdministracionServicio } from '../administracion/index.js';
import type { BonoRepositorio } from './cupo-invitaciones.bono.repositorio.js';
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
  /** Preguntas extra ganadas invitando, desde siempre. */
  preguntasGanadas: number;
  /** Lo que le queda de preguntas extra: ganadas menos usadas. */
  saldoExtra: number;
  /** Invitaciones premiadas en el mes de Chile actual y el tope del mes (RN-03). */
  premiadasMes: number;
  topeMes: number;
}

export interface Invitaciones {
  misInvitaciones(estudianteId: string): Promise<ResumenInvitaciones>;
}

export interface DependenciasInvitaciones {
  repositorio: Pick<CupoInvitacionesRepositorio, 'contarInvitaciones' | 'leerSaldoExtra'>;
  bono: Pick<BonoRepositorio, 'premiadasDelMes' | 'preguntasGanadas'>;
  administracion: Pick<AdministracionServicio, 'obtenerParametroEntero'>;
  cuentas: CuentaParaInvitar;
  /** Dirección pública de la consola, sin la barra final. */
  urlConsola: string;
  /** El mes de las premiadas es el de Chile de esta hora (RN-02). */
  reloj: Reloj;
}

export function crearInvitaciones(dependencias: DependenciasInvitaciones): Invitaciones {
  const { repositorio, bono, administracion, cuentas, urlConsola, reloj } = dependencias;
  return {
    async misInvitaciones(estudianteId) {
      const codigo = await cuentas.codigoInvitacion(estudianteId);
      if (!codigo) throw new ErrorNoEncontrado('La cuenta no existe.');
      const { registrados, verificados } = await repositorio.contarInvitaciones(estudianteId);
      return {
        codigo,
        link: `${urlConsola}/invitar/${codigo}`,
        registrados,
        verificados,
        preguntasGanadas: await bono.preguntasGanadas(estudianteId),
        saldoExtra: await repositorio.leerSaldoExtra(estudianteId),
        premiadasMes: await bono.premiadasDelMes(estudianteId, reloj()),
        topeMes: await administracion.obtenerParametroEntero('tope_invitaciones_mes'),
      };
    },
  };
}
