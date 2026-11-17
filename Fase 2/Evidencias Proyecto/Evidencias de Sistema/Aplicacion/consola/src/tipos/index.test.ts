import { describe, expect, it } from 'vitest';
import { esRolCuentaInterna } from '.';

describe('esRolCuentaInterna', () => {
  it('acepta solo los roles de cuenta interna', () => {
    expect(esRolCuentaInterna('admin')).toBe(true);
    expect(esRolCuentaInterna('docente')).toBe(true);
    expect(esRolCuentaInterna('revisor')).toBe(false);
  });
});
