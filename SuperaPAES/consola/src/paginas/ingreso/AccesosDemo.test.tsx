import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ACCESOS_DEMO, CLAVE_DEMO } from './accesos-demo';
import { FormularioIngreso } from './PaginaIngreso';

const dibujar = (tipo: 'editando' | 'enviando') =>
  renderToString(<FormularioIngreso estado={{ tipo }} alEnviar={vi.fn()} />);

describe('accesos de demostración de C00', () => {
  it('en desarrollo ofrece entrar como administrador y como cada docente', () => {
    const html = dibujar('editando');

    for (const etiqueta of ['Administrador', 'Docente 1', 'Docente 4']) {
      expect(html).toContain(etiqueta);
    }
    expect(CLAVE_DEMO).not.toBe('');
  });

  it('solo usa cuentas de ejemplo', () => {
    expect(ACCESOS_DEMO.every(({ correo }) => correo.endsWith('@ejemplo.cl'))).toBe(true);
  });

  it('mientras entra, los botones quedan deshabilitados', () => {
    const html = dibujar('enviando');

    expect(html).toMatch(/disabled=""[^>]*>Administrador/);
  });
});
