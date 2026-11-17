import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { CuentaInterna } from '../../tipos';
import { FormularioCuenta } from './FormularioCuenta';

const areas = [
  { id: 4, nombre: 'Biología' },
  { id: 1, nombre: 'Lenguaje' },
];
const nada = () => undefined;

describe('panel de C10', () => {
  it('al crear pide la contraseña inicial con los requisitos de RN-31 y las áreas del docente', () => {
    const html = renderToString(
      <FormularioCuenta cuenta={null} areas={areas} alGuardar={nada} alCancelar={nada} />,
    );

    expect(html).toContain('Crear usuario interno');
    expect(html).toContain('Contraseña inicial');
    expect(html).toContain('De 8 a 72 caracteres');
    expect(html).toContain('Biología');
  });

  it('al editar el correo es de solo lectura y la contraseña nueva es opcional', () => {
    const cuenta: CuentaInterna = {
      id: '2',
      nombre: 'Ana Admin',
      correo: 'ana@ejemplo.cl',
      rol: 'admin',
      activo: true,
      areas: [],
      creadoEn: '2026-10-23T12:00:00.000Z',
      ultimoAcceso: null,
    };

    const html = renderToString(
      <FormularioCuenta cuenta={cuenta} areas={areas} alGuardar={nada} alCancelar={nada} />,
    );

    expect(html).toContain('Editar a Ana Admin');
    expect(html).toContain('Contraseña nueva (opcional)');
    expect(html).toMatch(/value="ana@ejemplo.cl" readOnly=""|readOnly="" value="ana@ejemplo.cl"/);
    expect(html).not.toContain('Áreas de especialidad');
  });
});
