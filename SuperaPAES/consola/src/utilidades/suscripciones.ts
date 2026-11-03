// Formatos de la trazabilidad de suscripciones (C16, HU-56): fechas y meses de Chile, pesos y cómo se
// lee cada cambio de la línea de tiempo.
import type { DetalleSuscripcion } from '../tipos/suscripciones';

const fechaCorta = new Intl.DateTimeFormat('es-CL', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'America/Santiago',
});
const mesLargo = new Intl.DateTimeFormat('es-CL', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});
const pesos = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  maximumFractionDigits: 0,
});

/** Una fecha y hora de la API, como día de Chile («20-10-2026»). */
export const fechaDeChile = (instante: string) => fechaCorta.format(new Date(instante));

/** Un día AAAA-MM-DD como «20-10-2026», sin cambiarlo de zona horaria. */
export const dia = (texto: string) => texto.split('-').reverse().join('-');

/** «octubre de 2026» a partir de «2026-10». */
export const nombreDelMes = (mes: string) => mesLargo.format(new Date(`${mes}-01T00:00:00Z`));

/** «$1.990». */
export const enPesos = (monto: number) => pesos.format(monto);

/** El correo, o «Cuenta eliminada» si el estudiante la eliminó (sus datos quedan seudonimizados). */
export const estudianteDe = (correo: string | null) => correo ?? 'Cuenta eliminada';

type Cambio = DetalleSuscripcion['historial'][number];

/**
 * Título y explicación de un cambio, con su origen: el de plan (y el de estado, si cambió en el mismo
 * registro), el de estado o el primero.
 */
export function lecturaDelCambio(cambio: Cambio): { titulo: string; detalle: string } {
  const { estadoAnterior, estadoNuevo, planAnterior, planNuevo } = cambio;
  const estado =
    estadoAnterior && estadoAnterior.codigo !== estadoNuevo.codigo
      ? `${estadoAnterior.nombre} a ${estadoNuevo.nombre}`
      : null;
  const plan =
    planAnterior !== null && planAnterior !== planNuevo ? `${planAnterior} a ${planNuevo}` : null;
  const partes = [plan, estado ?? (plan || estadoAnterior ? null : planNuevo)];
  partes.push(`origen: ${cambio.origen.nombre.toLowerCase()}`, cambio.detalle);
  return {
    titulo: plan ? 'Cambio de plan' : estadoNuevo.nombre,
    detalle: partes.filter(Boolean).join(' · '),
  };
}

/** Cuántos avisos de la tienda se procesaron y cuántos tuvieron error. */
export function conteoDeAvisos(avisos: DetalleSuscripcion['avisos']) {
  const cuantos = (codigo: string) => avisos.filter((a) => a.resultado.codigo === codigo).length;
  return { procesados: cuantos('procesado'), conError: cuantos('error') };
}
