// Componente común de contraseñas (RNF-01, RN-31, DAS 4.3.5).
import { describe, expect, it } from 'vitest';
import {
  cifrarContrasena,
  COSTO_BCRYPT,
  compararContrasena,
  validarContrasena,
} from '../comun/contrasenas.js';

const CORREO = 'Ana.Docente@Ejemplo.cl';

describe('cifrarContrasena y compararContrasena', () => {
  it('guarda un hash bcrypt con el costo fijo del servidor y lo compara bien', async () => {
    const hash = await cifrarContrasena('una-clave-larga');

    expect(hash.startsWith('$2')).toBe(true);
    expect(hash).toContain(`$${COSTO_BCRYPT}$`);
    expect(COSTO_BCRYPT).toBe(12);
    expect(await compararContrasena('una-clave-larga', hash)).toBe(true);
    expect(await compararContrasena('otra-clave-larga', hash)).toBe(false);
  });
});

describe('validarContrasena (RN-31)', () => {
  it('acepta de 8 a 72 caracteres sin exigir símbolos, mayúsculas ni números', () => {
    expect(validarContrasena('abcdefgh', CORREO)).toBeNull();
    expect(validarContrasena('a'.repeat(72), CORREO)).toBeNull();
  });

  it('rechaza una contraseña de 7 caracteres', () => {
    expect(validarContrasena('abcdefg', CORREO)).toMatch(/al menos 8/);
  });

  it('rechaza una contraseña igual al correo, sin distinguir mayúsculas', () => {
    expect(validarContrasena('ana.docente@ejemplo.cl', CORREO)).toMatch(/igual al correo/);
  });

  it('rechaza una de 72 caracteres con tildes que pasa de 72 bytes', () => {
    const conTildes = 'á'.repeat(72); // 72 caracteres, 144 bytes en UTF-8

    expect([...conTildes]).toHaveLength(72);
    expect(validarContrasena(conTildes, CORREO)).toMatch(/demasiado larga/);
  });

  it('rechaza más de 72 caracteres', () => {
    expect(validarContrasena('a'.repeat(73), CORREO)).toMatch(/demasiado larga/);
  });
});
