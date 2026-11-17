import { describe, expect, it } from 'vitest';
import { problemaContrasena } from './contrasena';

describe('problemaContrasena (RN-31)', () => {
  it('acepta 8 caracteres sin símbolos', () => {
    expect(problemaContrasena('abcdefgh', 'ana@ejemplo.cl')).toBeNull();
  });

  it('indica qué requisito falta', () => {
    expect(problemaContrasena('abcdefg', 'ana@ejemplo.cl')).toMatch(/al menos 8/);
    expect(problemaContrasena('Ana@Ejemplo.cl', 'ana@ejemplo.cl')).toMatch(/igual al correo/);
    expect(problemaContrasena('á'.repeat(72), 'ana@ejemplo.cl')).toMatch(/demasiado larga/);
  });
});
