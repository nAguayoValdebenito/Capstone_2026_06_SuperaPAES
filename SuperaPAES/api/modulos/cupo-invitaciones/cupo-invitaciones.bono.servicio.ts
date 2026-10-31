// HU-47.1 (RF-A12, RN-03, CU-02a): cuando el invitado verifica su correo, su invitación queda
// verificada y quien lo invitó recibe bono_invitacion preguntas extra (5), una sola vez por invitado y
// hasta tope_invitaciones_mes premiadas por mes de Chile (10). El saldo se acumula, no vence y se usa
// después del cupo del día (CupoDiario, RN-01).
import type { Ejecutor } from '../../db/transaccion.js';
import type { AdministracionServicio } from '../administracion/index.js';
import type { BonoRepositorio } from './cupo-invitaciones.bono.repositorio.js';
import type { CuentaParaInvitar } from './cupo-invitaciones.invitaciones.servicio.js';

export interface BonoInvitacion {
  /**
   * Se llama dentro de la transacción que verifica el correo del invitado (módulo cuentas), con la hora
   * de su reloj. Sin invitación no hace nada; sobre el tope del mes, la invitación queda verificada sin
   * bono.
   */
  premiarInvitacion(invitadoId: string, ahora: Date, tx: Ejecutor): Promise<void>;
}

export interface DependenciasBono {
  repositorio: Pick<
    BonoRepositorio,
    'bloquearInvitacionDe' | 'marcarVerificada' | 'premiadasDelMes' | 'abonar'
  >;
  administracion: Pick<AdministracionServicio, 'obtenerParametroEntero'>;
  /** Si quien invitó borró su cuenta, su código ya no existe: no hay a quién premiar. */
  cuentas: CuentaParaInvitar;
}

export function crearBonoInvitacion(dependencias: DependenciasBono): BonoInvitacion {
  const { repositorio, administracion, cuentas } = dependencias;
  return {
    async premiarInvitacion(invitadoId, ahora, tx) {
      const invitacion = await repositorio.bloquearInvitacionDe(invitadoId, tx);
      if (!invitacion) return;
      if (!invitacion.verificada) await repositorio.marcarVerificada(invitacion.id, ahora, tx);
      if (invitacion.bonoEntregado) return;
      if (!(await cuentas.codigoInvitacion(invitacion.invitanteId))) return;
      const tope = await administracion.obtenerParametroEntero('tope_invitaciones_mes');
      if ((await repositorio.premiadasDelMes(invitacion.invitanteId, ahora, tx)) >= tope) return;
      const cantidad = await administracion.obtenerParametroEntero('bono_invitacion');
      await repositorio.abonar(
        { invitacionId: invitacion.id, invitanteId: invitacion.invitanteId, cantidad, ahora },
        tx,
      );
    },
  };
}
