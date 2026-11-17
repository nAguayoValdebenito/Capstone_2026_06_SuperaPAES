import { renderToString } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FILTROS_TEMARIO, useTemario } from '../../estado/temario';
import { TEMARIO_CONSULTA } from '../../pruebas/temario-consulta';
import type * as ModuloTemario from '../../estado/temario';
import { PaginaTemario } from './PaginaTemario';

vi.mock('../../estado/temario', async (original) => ({
  ...(await original<typeof ModuloTemario>()),
  useTemario: vi.fn(),
}));

const estado = () => ({
  carga: { tipo: 'lista' as const, datos: TEMARIO_CONSULTA },
  filtros: FILTROS_TEMARIO,
  filtrar: vi.fn(),
  limpiar: vi.fn(),
  reintentar: vi.fn(),
});

beforeEach(() => vi.mocked(useTemario).mockReturnValue(estado()));

describe('Temario C07 / verificación de HU-10', () => {
  it('muestra pruebas, ejes, contenidos, área, curso y criterios reales sin edición', () => {
    const html = renderToString(<PaginaTemario />);
    for (const texto of [
      'Temario',
      'Competencia Matemática 1',
      'Localizar',
      'Enteros',
      'Descriptores',
      'Matemática',
      '1° medio',
      'Modelar',
      'Usa modelos matemáticos.',
      'Inactivo',
      'Sin restricción por curso',
      '2 pruebas · 3 ejes · 3 contenidos',
    ])
      expect(html).toContain(texto);
    expect(html).not.toContain('En construcción');
    expect(html).not.toContain('Guardar');
    expect(html).not.toContain('Eliminar');
    expect(html).toContain('<details');
    expect(html).toContain('<summary');
  });

  it('ofrece filtros etiquetados y una búsqueda de texto', () => {
    const html = renderToString(<PaginaTemario />);
    for (const texto of [
      'Todas las pruebas',
      'Todas las áreas',
      'type="search"',
      'Limpiar filtros',
      'Áreas de especialidad (2)',
    ])
      expect(html).toContain(texto);
  });

  it('distingue datos vacíos y una búsqueda sin coincidencias', () => {
    vi.mocked(useTemario).mockReturnValue({
      ...estado(),
      carga: { tipo: 'lista', datos: { areas: [], pruebas: [] } },
    });
    expect(renderToString(<PaginaTemario />)).toContain('Sin temario cargado');
    vi.mocked(useTemario).mockReturnValue({
      ...estado(),
      filtros: { ...FILTROS_TEMARIO, texto: 'inexistente' },
    });
    const html = renderToString(<PaginaTemario />);
    expect(html).toContain('No hay coincidencias');
    expect(html).toContain('0 pruebas · 0 ejes · 0 contenidos');
  });

  it('muestra carga y permite reintentar el error sin mostrar resultados falsos', () => {
    vi.mocked(useTemario).mockReturnValue({ ...estado(), carga: { tipo: 'cargando' } });
    expect(renderToString(<PaginaTemario />)).toContain('Cargando el temario');
    vi.mocked(useTemario).mockReturnValue({
      ...estado(),
      carga: { tipo: 'fallida', codigo: 'SIN_CONEXION', mensaje: 'Sin conexión.' },
    });
    const html = renderToString(<PaginaTemario />);
    expect(html).toContain('Sin conexión.');
    expect(html).toContain('Reintentar');
    expect(html).not.toContain('Enteros');
  });

  it('escapa los textos de la base en descriptores y nombres', () => {
    const datos = structuredClone(TEMARIO_CONSULTA);
    datos.pruebas[0]!.ejes[0]!.contenidos[0]!.descriptores = '<script>alert(1)</script>';
    vi.mocked(useTemario).mockReturnValue({ ...estado(), carga: { tipo: 'lista', datos } });
    const html = renderToString(<PaginaTemario />);
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>');
  });
});
