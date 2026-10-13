import { describe, expect, it } from 'vitest';
import { relojDelSistema } from '../comun/reloj.js';
import { esRolCuentaInterna } from '../comun/roles.js';

describe('esRolCuentaInterna', () => {
  it('acepta solo los roles de cuenta interna', () => {
    expect(esRolCuentaInterna('admin')).toBe(true);
    expect(esRolCuentaInterna('docente')).toBe(true);
    expect(esRolCuentaInterna('revisor')).toBe(false);
    expect(esRolCuentaInterna(undefined)).toBe(false);
    expect(esRolCuentaInterna(1)).toBe(false);
  });
});

describe('relojDelSistema', () => {
  it('entrega la hora actual', () => {
    const antes = Date.now();
    const hora = relojDelSistema().getTime();
    expect(hora).toBeGreaterThanOrEqual(antes);
    expect(hora).toBeLessThanOrEqual(Date.now());
  });
});
