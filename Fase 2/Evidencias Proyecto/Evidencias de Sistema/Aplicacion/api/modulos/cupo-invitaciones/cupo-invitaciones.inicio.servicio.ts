// HU-35.1 (RF-A05, CU-06 paso 1, RN-01, RN-02): lo que muestra el inicio de la app. Cupo del día,
// saldo de preguntas extra, hora del próximo reinicio y racha de días practicando.
// Solo consulta: no crea la fila del día, que crea la primera respuesta (cupo-invitaciones.cupo.servicio).
import { ErrorNoEncontrado } from '../../comun/errores.js';
import type { Reloj } from '../../comun/reloj.js';
import type { AdministracionServicio } from '../administracion/index.js';
import { maximoDelDia } from './cupo-invitaciones.cupo.servicio.js';
import type { CupoInvitacionesRepositorio } from './cupo-invitaciones.repositorio.js';

/** Puerto de cuentas: el correo verificado decide el máximo del día y la racha vive en la cuenta. */
export interface CuentaParaInicio {
  estadoParaInicio(
    estudianteId: string,
    ahora: Date,
  ): Promise<{ correoVerificado: boolean; racha: number } | null>;
}

export interface CupoDeHoy {
  maximo: number;
  usadas: number;
  restantes: number;
  /** Preguntas extra ganadas con invitaciones; se usan cuando se acaba el cupo del día. */
  saldoExtra: number;
  /** Las 00:00 de Chile siguientes: ahí el cupo vuelve al máximo (RN-02). */
  reiniciaEn: Date;
  /** Días seguidos practicando (RF-A05). */
  racha: number;
}

export interface InicioCupo {
  /** HU-35 esc. 1 y 2: el cupo, el saldo, el reinicio y la racha del estudiante, a la hora del reloj. */
  cupoDeHoy(estudianteId: string): Promise<CupoDeHoy>;
}

export interface DependenciasInicioCupo {
  repositorio: CupoInvitacionesRepositorio;
  administracion: Pick<AdministracionServicio, 'obtenerParametroEntero'>;
  cuentas: CuentaParaInicio;
  reloj: Reloj;
}

async function cupoDeHoy(dependencias: DependenciasInicioCupo, estudianteId: string) {
  const { repositorio, cuentas } = dependencias;
  const ahora = dependencias.reloj();
  const cuenta = await cuentas.estadoParaInicio(estudianteId, ahora);
  if (!cuenta) throw new ErrorNoEncontrado('La cuenta no existe.');
  const fila = await repositorio.leerCupoDelDia(estudianteId, ahora);
  const maximo = fila?.maximo ?? (await maximoDelDia(dependencias, cuenta.correoVerificado));
  const usadas = fila?.usadas ?? 0;
  return {
    maximo,
    usadas,
    restantes: maximo - usadas,
    saldoExtra: await repositorio.leerSaldoExtra(estudianteId),
    reiniciaEn: await repositorio.proximoReinicio(ahora),
    racha: cuenta.racha,
  };
}

export function crearInicioCupo(dependencias: DependenciasInicioCupo): InicioCupo {
  return { cupoDeHoy: (estudianteId) => cupoDeHoy(dependencias, estudianteId) };
}
