import { describe, expect, it } from 'vitest';
import { M1 } from '../pruebas/temario';
import type { Lote } from '../tipos/generador';
import {
  enlaceAlBanco,
  errorDelPedido,
  hayPendientes,
  motivosLegibles,
  notaDeCierre,
  ubicarContenido,
} from './generador';

const lote = (cambios: Partial<Lote> = {}): Lote => ({
  id: '32',
  estado: 'completado',
  contenidoId: 110,
  cantidad: 5,
  conTexto: false,
  validas: 3,
  descartadas: 2,
  procesadas: 5,
  modelo: 'modelo-de-prueba',
  motivos: null,
  creadoEn: '2026-11-04T12:00:00.000Z',
  ...cambios,
});

const CANTIDAD_INVALIDA = 'La cantidad debe ser de 1 a 10 preguntas.';

describe('motivos del lote (HU-17.3)', () => {
  it('traduce descartes y fallas, y suma los códigos desconocidos', () => {
    const motivos = {
      porMotivo: { alternativa_repetida: 2, nuevo: 1 },
      fallas: { IA_NO_DISPONIBLE: 1, otro: 1 },
    };

    expect(motivosLegibles(lote({ motivos }))).toEqual([
      { texto: 'Tenía alternativas repetidas', cantidad: 2 },
      { texto: 'Otro motivo', cantidad: 2 },
      { texto: 'La IA no respondió', cantidad: 1 },
    ]);
  });

  it('sin motivos no muestra nada, y un cierre normal no lleva nota', () => {
    expect(motivosLegibles(lote())).toEqual([]);
    expect(notaDeCierre(lote({ motivos: { cierre: 'completo' } }))).toBeNull();
  });

  it('explica por qué se detuvo el lote', () => {
    expect(notaDeCierre(lote({ motivos: { cierre: 'ia_no_disponible' } }))).toBe(
      'El lote se detuvo porque la IA dejó de responder.',
    );
  });
});

describe('ubicación del lote', () => {
  it('encuentra el eje y la prueba del contenido', () => {
    expect(ubicarContenido([M1], 110)?.eje.nombre).toBe('Álgebra');
    expect(ubicarContenido([M1], 999)).toBeNull();
  });

  it('enlaza a los borradores de IA de ese contenido', () => {
    expect(enlaceAlBanco([M1], lote())).toBe(
      '/banco?prueba=2&eje=11&contenido=110&estado=borrador&origen=ia',
    );
  });
});

describe('avance y pedido', () => {
  it('sigue consultando solo si hay un lote en proceso', () => {
    expect(hayPendientes([lote(), lote({ estado: 'pendiente' })])).toBe(true);
    expect(hayPendientes([lote({ estado: 'fallido' })])).toBe(false);
  });

  it.each([
    [{ cantidad: '5', conTexto: false }, 'Elige la prueba, el eje y el contenido.'],
    [{ contenidoId: 1, cantidad: '0', conTexto: false }, CANTIDAD_INVALIDA],
    [{ contenidoId: 1, cantidad: '11', conTexto: false }, CANTIDAD_INVALIDA],
    [{ contenidoId: 1, cantidad: '2.5', conTexto: false }, CANTIDAD_INVALIDA],
    [
      { contenidoId: 1, cantidad: '2', conTexto: true },
      'Con texto de lectura debes pedir al menos 3 preguntas.',
    ],
    [{ contenidoId: 1, cantidad: '3', conTexto: true }, null],
    [{ contenidoId: 1, cantidad: '10', conTexto: false }, null],
  ])('revisa %j', (campos, esperado) => {
    expect(errorDelPedido(campos)).toBe(esperado);
  });
});
