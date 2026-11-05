import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useGenerador } from '../../estado/generador';
import { M1 } from '../../pruebas/temario';
import type { Lote } from '../../tipos/generador';
import { PaginaGenerador } from './PaginaGenerador';

vi.mock('../../estado/generador', () => ({ useGenerador: vi.fn() }));

const lote: Lote = {
  id: '32',
  estado: 'completado',
  contenidoId: 110,
  cantidad: 5,
  conTexto: false,
  validas: 3,
  descartadas: 2,
  procesadas: 5,
  modelo: 'modelo-de-prueba',
  motivos: { porMotivo: { enunciado_duplicado: 2 } },
  creadoEn: '2026-11-04T12:00:00.000Z',
};

function estado(lotes: Lote[]): ReturnType<typeof useGenerador> {
  return {
    temario: {
      tipo: 'lista',
      datos: { pruebas: [M1], estados: [], origenes: [], dificultades: [] },
    },
    lotes: {
      tipo: 'lista',
      datos: { lotes, paginacion: { pagina: 1, porPagina: 20, total: lotes.length } },
    },
    lote: lotes[0] ?? null,
    elegir: vi.fn(),
    irAPagina: vi.fn(),
    pedir: vi.fn().mockResolvedValue(undefined),
    enviando: false,
    error: null,
  };
}

const dibujar = () =>
  renderToString(
    <MemoryRouter>
      <PaginaGenerador />
    </MemoryRouter>,
  );

beforeEach(() => vi.mocked(useGenerador).mockReturnValue(estado([lote])));

describe('Generador C05', () => {
  it('muestra el formulario, el resultado con sus motivos y el enlace al banco', () => {
    const html = dibujar();
    for (const texto of [
      'Nuevo lote',
      'Generar lote',
      'Ecuaciones',
      'Completado',
      'El enunciado ya estaba en el banco o en el lote',
      'Ver en el banco de preguntas',
      'Lotes anteriores',
    ]) {
      expect(html).toContain(texto);
    }
    expect(html).toContain('/banco?prueba=2&amp;eje=11&amp;contenido=110');
  });

  it('muestra el avance mientras el lote está en proceso', () => {
    const enProceso: Lote = { ...lote, estado: 'pendiente', procesadas: 2, descartadas: 0 };
    vi.mocked(useGenerador).mockReturnValue(estado([enProceso]));

    const html = dibujar();

    expect(html).toContain('En proceso');
    expect(html).toContain('<progress');
  });

  it('sin válidas no ofrece ir al banco, y explica por qué falló', () => {
    const fallido: Lote = {
      ...lote,
      estado: 'fallido',
      validas: 0,
      motivos: { cierre: 'ia_no_disponible', fallas: { IA_NO_DISPONIBLE: 3 } },
    };
    vi.mocked(useGenerador).mockReturnValue(estado([fallido]));

    const html = dibujar();

    expect(html).toContain('El lote se detuvo porque la IA dejó de responder.');
    expect(html).not.toContain('Ver en el banco de preguntas');
  });

  it('sin lotes invita a pedir el primero y no muestra la tabla', () => {
    vi.mocked(useGenerador).mockReturnValue(estado([]));

    const html = dibujar();

    expect(html).toContain('Todavía no hay lotes');
    expect(html).not.toContain('Lotes anteriores');
  });
});
