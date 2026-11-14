// Regla de la pauta (RN-11): con más criterios en «No» que max_no_para_aprobar no se puede aprobar.
import { describe, expect, it } from 'vitest';
import {
  camposVacios,
  contarNo,
  motivoSinAprobar,
  puedeAprobar,
  sinAprobacionNoPermitida,
  type CamposRevision,
} from './formulario-revision';

const con = (respuestas: (boolean | null)[], decision: string | null = null): CamposRevision => ({
  ...camposVacios(),
  decision,
  criterios: Object.fromEntries(
    respuestas.map((cumple, i) => [
      `c${String(i)}`,
      { cumple, observacion: cumple === false ? 'x' : '' },
    ]),
  ),
});

describe('aprobar con criterios en «No»', () => {
  it('cuenta solo los «No» respondidos (no los sin responder)', () => {
    expect(contarNo(con([true, false, null, false]))).toBe(2);
  });

  it('se puede aprobar hasta el máximo y no más allá', () => {
    expect(puedeAprobar(con([false, false, true]), 2)).toBe(true);
    expect(puedeAprobar(con([false, false, false]), 2)).toBe(false);
    expect(puedeAprobar(con([false]), 0)).toBe(false);
  });

  it('explica por qué no, en singular y plural', () => {
    expect(motivoSinAprobar(con([false, false, false]), 2)).toBe(
      'Tienes 3 criterios en «No» y se aprueba con 2 como máximo: obsérvala o recházala.',
    );
    expect(motivoSinAprobar(con([false]), 0)).toContain('Tienes 1 criterio en «No»');
    expect(motivoSinAprobar(con([false]), 1)).toBeNull();
  });

  it('quita la decisión «aprobar» que ya no cabe y deja las otras', () => {
    const maximo = { maximoNoParaAprobar: 1 };
    expect(sinAprobacionNoPermitida(con([false, false], 'aprobar'), maximo).decision).toBeNull();
    expect(sinAprobacionNoPermitida(con([false], 'aprobar'), maximo).decision).toBe('aprobar');
    expect(sinAprobacionNoPermitida(con([false, false], 'observar'), maximo).decision).toBe(
      'observar',
    );
  });
});
