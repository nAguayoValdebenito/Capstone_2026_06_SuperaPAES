// Variaciones del Panel (C01): el cálculo frente al período anterior y cómo se muestran.
import { textoDibujado } from '../../pruebas/dibujo';
import { describe, expect, it } from 'vitest';
import { variacionEnPuntos, variacionRelativa } from '../../utilidades/panel';
import { CambioDeCifra } from './CambioDeCifra';

describe('variación relativa', () => {
  it('sube y baja en porcentaje redondeado, con el signo en el texto', () => {
    expect(variacionRelativa(118, 100)).toEqual({ direccion: 'sube', texto: '+18 %' });
    expect(variacionRelativa(97, 100)).toEqual({ direccion: 'baja', texto: '−3 %' });
  });

  it('sin cambio si es igual o si el redondeo da 0', () => {
    expect(variacionRelativa(100, 100)?.direccion).toBe('igual');
    expect(variacionRelativa(1000, 1001)?.texto).toBe('Sin cambio');
  });

  it('con 0 antes no hay con qué compararlo, salvo que siga en 0', () => {
    expect(variacionRelativa(5, 0)).toBeNull();
    expect(variacionRelativa(0, 0)?.direccion).toBe('igual');
  });
});

describe('variación de una tasa en puntos', () => {
  it('es la diferencia en puntos porcentuales', () => {
    expect(variacionEnPuntos(71, 74)).toEqual({ direccion: 'baja', texto: '−3 pp' });
    expect(variacionEnPuntos(75, 70)).toEqual({ direccion: 'sube', texto: '+5 pp' });
    expect(variacionEnPuntos(70, 70)?.direccion).toBe('igual');
  });

  it('sin tasa en alguno de los dos períodos no hay variación', () => {
    expect(variacionEnPuntos(null, 70)).toBeNull();
    expect(variacionEnPuntos(70, null)).toBeNull();
  });
});

describe('pastilla del cambio', () => {
  it('lleva la flecha y el signo a la vista y la frase completa para el lector', () => {
    const html = textoDibujado(
      <CambioDeCifra variacion={variacionRelativa(118, 100)} frente="al inicio del período" />,
    );
    expect(html).toContain('variacion--sube');
    expect(html).toContain('aria-hidden="true">▲ +18 %');
    expect(html).toContain('sube +18 % frente al inicio del período');
  });

  it('una baja es una cruz de atención y no depende solo del color', () => {
    const html = textoDibujado(
      <CambioDeCifra variacion={variacionEnPuntos(71, 74)} frente="al período anterior" />,
    );
    expect(html).toContain('variacion--baja');
    expect(html).toContain('▼ −3 pp');
  });

  it('no dibuja nada si no hay variación', () => {
    expect(textoDibujado(<CambioDeCifra variacion={null} frente="x" />)).toBe('');
  });
});
