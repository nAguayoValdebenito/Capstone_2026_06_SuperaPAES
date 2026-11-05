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
