// Componente común de contraseñas (RNF-01, RN-31, DAS 4.3.5) y requisitos de la contraseña con la lista
// de contraseñas comunes (HU-01.4, CP-54).
import { describe, expect, it } from 'vitest';
import { CONTRASENAS_COMUNES } from '../comun/contrasenas-comunes.js';
import {
  cifrarContrasena,
  COSTO_BCRYPT,
  compararContrasena,
  normalizarParaComparar,
  validarContrasena,
} from '../comun/contrasenas.js';

const CORREO = 'Ana.Docente@Ejemplo.cl';
const motivoDe = (texto: string) => validarContrasena(texto, CORREO)?.motivo ?? null;

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

describe('validarContrasena: CP-54 (RN-31, HU-01.4)', () => {
  it('paso 1: rechaza 7 y 73 caracteres, acepta 8 y 72, cada una con su motivo', () => {
    expect(validarContrasena('abcdefg', CORREO)).toEqual({
      motivo: 'contrasena_corta',
      mensaje: 'La contraseña debe tener al menos 8 caracteres.',
    });
    expect(motivoDe('abcdefgh')).toBeNull();
    expect(motivoDe('k'.repeat(72))).toBeNull();
    expect(validarContrasena('k'.repeat(73), CORREO)).toEqual({
      motivo: 'contrasena_larga',
      mensaje: 'La contraseña puede tener hasta 72 caracteres.',
    });
  });

  it('paso 2: rechaza una contraseña común y una igual al correo', () => {
    expect(validarContrasena('12345678', CORREO)?.motivo).toBe('contrasena_comun');
    expect(validarContrasena('12345678', CORREO)?.mensaje).toMatch(/muy común/);
    expect(motivoDe('ana.docente@ejemplo.cl')).toBe('contrasena_igual_correo');
  });

  it('paso 3: acepta una de 8 caracteres sin símbolos, mayúsculas ni números', () => {
    expect(motivoDe('abcdefgh')).toBeNull();
    expect(motivoDe('tranquilo')).toBeNull();
  });

  it('paso 4: rechaza una de menos de 72 caracteres que pasa de 72 bytes por sus emojis', () => {
    const conEmojis = '😀'.repeat(20); // 20 caracteres, 80 bytes en UTF-8

    expect([...conEmojis]).toHaveLength(20);
    expect(validarContrasena(conEmojis, CORREO)).toEqual({
      motivo: 'contrasena_bytes',
      mensaje: expect.stringMatching(/demasiado larga/) as string,
    });
  });

  it('también por tildes: 72 caracteres con tildes pasan de 72 bytes', () => {
    expect(motivoDe('á'.repeat(72))).toBe('contrasena_bytes');
  });

  it('la lista de comunes ignora mayúsculas y tildes', () => {
    expect(motivoDe('PASSWORD')).toBe('contrasena_comun');
    expect(motivoDe('Contraseña123')).toBe('contrasena_comun');
    expect(motivoDe('contrasena123')).toBe('contrasena_comun');
    expect(motivoDe('ColoColo')).toBe('contrasena_comun');
    expect(motivoDe('SuperaPAES2027')).toBe('contrasena_comun');
  });

  it('el correo se revisa antes que la lista, y el largo antes que todo', () => {
    expect(validarContrasena('password', 'password')?.motivo).toBe('contrasena_igual_correo');
    expect(motivoDe('qwerty')).toBe('contrasena_corta');
  });
});

describe('lista de contraseñas comunes', () => {
  it('tiene entre 500 y 1.000 entradas, sin repetir', () => {
    expect(CONTRASENAS_COMUNES.length).toBeGreaterThanOrEqual(500);
    expect(CONTRASENAS_COMUNES.length).toBeLessThanOrEqual(1000);
    expect(new Set(CONTRASENAS_COMUNES).size).toBe(CONTRASENAS_COMUNES.length);
  });

  it('cada entrada está normalizada (minúsculas, sin tildes) y tiene de 8 a 72 caracteres', () => {
    const malas = CONTRASENAS_COMUNES.filter(
      (c) => normalizarParaComparar(c) !== c || c.length < 8 || c.length > 72,
    );

    expect(malas).toEqual([]);
  });

  it('no incluye las que CP-54 exige aceptar', () => {
    expect(CONTRASENAS_COMUNES).not.toContain('abcdefgh');
  });
});
