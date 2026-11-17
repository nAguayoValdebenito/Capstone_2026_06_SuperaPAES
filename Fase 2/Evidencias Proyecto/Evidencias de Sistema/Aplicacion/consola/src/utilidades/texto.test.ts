import { describe, expect, it } from 'vitest';
import { contiene, sinTildes } from './texto';

describe('texto sin tildes (búsqueda global)', () => {
  it('quita tildes y mayúsculas', () => {
    expect(sinTildes('  Configuración ')).toBe('configuracion');
    expect(sinTildes('Ñandú Ú')).toBe('nandu u');
  });

  it('compara sin distinguir tildes ni mayúsculas', () => {
    expect(contiene('Revisión docente', 'REVISION')).toBe(true);
    expect(contiene('Banco de preguntas', 'pregunta')).toBe(true);
    expect(contiene('Banco de preguntas', 'planes')).toBe(false);
  });
});
