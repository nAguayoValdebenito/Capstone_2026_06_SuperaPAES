import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { RespuestasDelDia } from '../../tipos/panel';
import {
  alturaDeBarra,
  cantidad,
  diaCorto,
  textoDeBarra,
  totalDeRespuestas,
} from '../../utilidades/panel';
import { GraficoRespuestas } from './GraficoRespuestas';

const dias: RespuestasDelDia[] = [
  { dia: '2026-11-03', total: 0 },
  { dia: '2026-11-04', total: 1 },
  { dia: '2026-11-05', total: 200 },
];

describe('gráfico de respuestas del Panel (C01)', () => {
  it('escala las barras y deja ver un día con pocas respuestas', () => {
    expect(alturaDeBarra(200, dias)).toBe(100);
    expect(alturaDeBarra(0, dias)).toBe(0);
    expect(alturaDeBarra(1, dias)).toBe(3);
  });

  it('no divide por cero sin respuestas', () => {
    expect(alturaDeBarra(0, [{ dia: '2026-11-05', total: 0 }])).toBe(0);
  });

  it('dibuja cada día, también los que no tienen respuestas', () => {
    const html = renderToString(<GraficoRespuestas dias={dias} />);

    expect(html.match(/<li /g)).toHaveLength(3);
    expect(html).toContain('03/11: 0 respuestas');
    expect(html).toContain('04/11: 1 respuesta');
    expect(html).toContain('>201<');
  });

  it('escribe los textos del gráfico', () => {
    expect(diaCorto('2026-11-05')).toBe('05/11');
    expect(cantidad(1, 'nueva', 'nuevas')).toBe('1 nueva');
    expect(cantidad(0, 'nueva', 'nuevas')).toBe('0 nuevas');
    expect(totalDeRespuestas(dias)).toBe(201);
    expect(textoDeBarra({ dia: '2026-11-05', total: 2 })).toBe('05/11: 2 respuestas');
  });
});
