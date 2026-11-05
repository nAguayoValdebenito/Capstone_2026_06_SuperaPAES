import { renderToString } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { conEstudiante, useEstudiantes, type BusquedaEstudiantes } from '../../estado/estudiantes';
import type * as EstadoEstudiantes from '../../estado/estudiantes';
import type { EstudianteConsola } from '../../tipos/estudiantes';
import { PaginaEstudiantes } from './PaginaEstudiantes';

vi.mock('../../estado/estudiantes', async (original) => ({
  ...(await original<typeof EstadoEstudiantes>()),
  useEstudiantes: vi.fn(),
}));

const estudiante = (cambios: Partial<EstudianteConsola> = {}): EstudianteConsola => ({
  id: 7,
  nombre: 'Daniela',
  correo: 'daniela@ejemplo.cl',
  correoVerificado: false,
  creadoEn: '2026-11-04T12:00:00.000Z',
  ...cambios,
});

function preparar(busqueda: BusquedaEstudiantes, cambios = {}) {
  vi.mocked(useEstudiantes).mockReturnValue({
    busqueda,
    confirmando: null,
    error: null,
    aviso: null,
    buscar: vi.fn().mockResolvedValue(undefined),
    confirmar: vi.fn().mockResolvedValue(undefined),
    ...cambios,
  });
}

beforeEach(() => preparar({ tipo: 'inicial' }));

describe('Estudiantes C15 (CU-02b)', () => {
  it('parte solo con el buscador, sin ninguna tabla', () => {
    const html = renderToString(<PaginaEstudiantes />);

    expect(html).toContain('Buscar');
    expect(html).toContain('su cupo diario sube a 20 preguntas');
    expect(html).not.toContain('<table');
  });

  it('ofrece confirmar una cuenta sin verificar', () => {
    preparar({ tipo: 'lista', estudiantes: [estudiante()] });

    const html = renderToString(<PaginaEstudiantes />);

    expect(html).toContain('daniela@ejemplo.cl');
    expect(html).toContain('Confirmar cuenta');
  });

  it('no ofrece confirmar una cuenta ya verificada', () => {
    preparar({ tipo: 'lista', estudiantes: [estudiante({ correoVerificado: true })] });

    expect(renderToString(<PaginaEstudiantes />)).not.toContain('Confirmar cuenta');
  });

  it('dice si no encontró a nadie', () => {
    preparar({ tipo: 'lista', estudiantes: [] });

    expect(renderToString(<PaginaEstudiantes />)).toContain('No hay estudiantes con ese correo.');
  });

  it('muestra el error de la API y el aviso de la confirmación', () => {
    preparar(
      { tipo: 'lista', estudiantes: [estudiante({ correoVerificado: true })] },
      { error: 'El correo ya está verificado.', aviso: 'Cuenta confirmada.' },
    );

    const html = renderToString(<PaginaEstudiantes />);

    expect(html).toContain('El correo ya está verificado.');
    expect(html).toContain('Cuenta confirmada.');
  });

  it('cambia solo al estudiante confirmado', () => {
    const otro = estudiante({ id: 8, correo: 'otro@ejemplo.cl' });

    const lista = conEstudiante([estudiante(), otro], estudiante({ correoVerificado: true }));

    expect(lista.map((e) => e.correoVerificado)).toEqual([true, false]);
  });
});
