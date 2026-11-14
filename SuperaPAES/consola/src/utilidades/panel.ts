// Cálculos de C01 · Panel: los períodos, la altura de cada barra y los textos del gráfico.
import type { PeriodoPanel, RespuestasDelDia } from '../tipos/panel';

export const PERIODOS: readonly { valor: PeriodoPanel; texto: string }[] = [
  { valor: 'hoy', texto: 'Hoy' },
  { valor: '7d', texto: 'Últimos 7 días' },
  { valor: '30d', texto: 'Últimos 30 días' },
  { valor: 'mes', texto: 'Este mes' },
];

/** La altura de cada barra, de 0 a 100. Un día con respuestas siempre se alcanza a ver. */
export function alturaDeBarra(total: number, dias: readonly RespuestasDelDia[]): number {
  const maximo = Math.max(...dias.map((dia) => dia.total), 0);
  if (total === 0 || maximo === 0) return 0;
  return Math.max((total / maximo) * 100, 3);
}

export const totalDeRespuestas = (dias: readonly RespuestasDelDia[]) =>
  dias.reduce((suma, dia) => suma + dia.total, 0);

/** «05/11», desde AAAA-MM-DD. */
export const diaCorto = (dia: string) => dia.slice(8, 10) + '/' + dia.slice(5, 7);

/** «1 nueva», «3 nuevas». */
export const cantidad = (total: number, singular: string, plural: string) =>
  `${String(total)} ${total === 1 ? singular : plural}`;

export const textoDeBarra = ({ dia, total }: RespuestasDelDia) =>
  `${diaCorto(dia)}: ${cantidad(total, 'respuesta', 'respuestas')}`;

/** Cómo cambió una cifra frente al período anterior: hacia dónde y cómo se escribe. */
export interface Variacion {
  direccion: 'sube' | 'baja' | 'igual';
  /** «+18 %», «−3 %», «+4 pp» o «Sin cambio». */
  texto: string;
}

const MENOS = '−';
const signo = (n: number) => (n > 0 ? '+' : MENOS);

/** El cambio relativo en porcentaje; null si antes era 0 y ahora no (no hay con qué compararlo). */
export function variacionRelativa(actual: number, anterior: number): Variacion | null {
  if (anterior === 0) return actual === 0 ? { direccion: 'igual', texto: 'Sin cambio' } : null;
  const cambio = Math.round(((actual - anterior) / anterior) * 100);
  if (cambio === 0) return { direccion: 'igual', texto: 'Sin cambio' };
  return {
    direccion: cambio > 0 ? 'sube' : 'baja',
    texto: `${signo(cambio)}${String(Math.abs(cambio))} %`,
  };
}

/** El cambio de una tasa en puntos porcentuales; null si falta alguna de las dos. */
export function variacionEnPuntos(
  actual: number | null,
  anterior: number | null,
): Variacion | null {
  if (actual === null || anterior === null) return null;
  const cambio = actual - anterior;
  if (cambio === 0) return { direccion: 'igual', texto: 'Sin cambio' };
  return {
    direccion: cambio > 0 ? 'sube' : 'baja',
    texto: `${signo(cambio)}${String(Math.abs(cambio))} pp`,
  };
}
