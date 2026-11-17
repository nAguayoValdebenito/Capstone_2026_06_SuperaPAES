// Correo del aviso de renovación anual (HU-45.3, CU-12 4.c): la fecha, el monto y cómo cancelar, sin datos de
// la compra. El remitente lo pone el proveedor de correo. Mi suscripción (A44) todavía no existe en la app:
// por eso el enlace lleva directo a la tienda, que es donde se cancela (RN-05).
import type { MensajeCorreo } from '../../adaptadores/correo/proveedor.js';
import type { Tienda } from '../../adaptadores/pagos/pasarela.js';
import { TIENDA } from './suscripciones.avisos.correo.js';

export interface DatosAvisoRenovacion {
  nombre: string;
  para: string;
  plan: string;
  periodoFin: Date;
  montoClp: number;
  tienda: Tienda;
  gestionUrl: string;
}

const FECHA_CHILE = new Intl.DateTimeFormat('es-CL', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'America/Santiago',
});
const PESOS = new Intl.NumberFormat('es-CL');

const conMayuscula = (texto: string) => texto.charAt(0).toUpperCase() + texto.slice(1);

export function mensajeDeRenovacion(datos: DatosAvisoRenovacion): MensajeCorreo {
  const { nombre, para, plan, periodoFin, montoClp, tienda, gestionUrl } = datos;
  const fecha = FECHA_CHILE.format(periodoFin);
  return {
    para,
    asunto: `Tu plan anual de Supera PAES se renueva el ${fecha}`,
    texto: [
      `Hola, ${nombre}:`,
      '',
      `Tu plan ${plan} se renueva el ${fecha}.`,
      `${conMayuscula(TIENDA[tienda])} cobrará $${PESOS.format(montoClp)}.`,
      'Si cambiaste de plan, el monto puede ser distinto.',
      '',
      'Si quieres seguir con tu plan, no tienes que hacer nada.',
      '',
      `Para cancelar, hazlo antes de esa fecha en la gestión de suscripciones de ${TIENDA[tienda]}:`,
      gestionUrl,
      `Mantienes tu plan hasta el ${fecha}.`,
      '',
      'Equipo Supera PAES',
    ].join('\n'),
  };
}
