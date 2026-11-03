// Correo de mora (CU-12 4.b, HU-44): cuando un cobro de renovación falla y la suscripción queda en mora, se
// avisa al estudiante que mantiene su plan mientras la tienda reintenta y que revise su medio de pago. Va
// en segundo plano, después de la transacción del aviso: si no sale, la respuesta a la tienda no cambia.
// Una cuenta borrada no recibe correos (RN-34): sus avisos solo quedan en el historial seudonimizado.
import type { ProveedorCorreo, Tienda } from '../../adaptadores/fabrica.js';
import type { MensajeCorreo } from '../../adaptadores/correo/proveedor.js';
import { ErrorNoEncontrado } from '../../comun/errores.js';
import { registro } from '../../comun/registro.js';
import type { CuentasServicio } from '../cuentas/index.js';

export interface DependenciasCorreoMora {
  /** Cuentas se crea después de suscripciones: solo se pide al enviar. */
  cuentas: () => Pick<CuentasServicio, 'exportarCuenta'>;
  correo: ProveedorCorreo;
  segundoPlano: (tarea: () => Promise<void>) => void;
}

const TIENDA: Record<Tienda, string> = { google_play: 'Google Play', app_store: 'la App Store' };

/** Texto del correo, breve y sin datos de la compra. El remitente lo pone el proveedor de correo. */
export function mensajeDeMora(nombre: string, para: string, tienda: Tienda): MensajeCorreo {
  return {
    para,
    asunto: 'No se pudo cobrar la renovación de tu plan',
    texto: [
      `Hola, ${nombre}:`,
      '',
      `${TIENDA[tienda]} no pudo cobrar la renovación de tu plan de Supera PAES. Mientras la tienda vuelve a`,
      'intentarlo, sigues con todos los beneficios de tu plan.',
      '',
      `Para no perderlos, revisa tu medio de pago en ${TIENDA[tienda]}. Si la tienda no logra cobrar, el plan`,
      'termina y vuelves al plan Gratis. También lo puedes ver en la app, en Perfil > Mi suscripción.',
      '',
      'Equipo Supera PAES',
    ].join('\n'),
  };
}

/** Programa el correo de mora del estudiante; un error solo se registra por su tipo. */
export function avisarMora(d: DependenciasCorreoMora, estudianteId: string, tienda: Tienda): void {
  d.segundoPlano(async () => {
    try {
      const { cuenta } = await d.cuentas().exportarCuenta(estudianteId);
      await d.correo.enviar(mensajeDeMora(cuenta.nombre, cuenta.correo, tienda));
    } catch (error) {
      if (error instanceof ErrorNoEncontrado) return;
      registro.error('No se pudo enviar el correo de mora', {
        tienda,
        error: error instanceof Error ? error.name : 'desconocido',
      });
    }
  });
}
