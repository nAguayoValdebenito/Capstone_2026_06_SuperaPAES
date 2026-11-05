import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useGenerador } from '../../estado/generador';
import { useTextosGenerados } from '../../estado/textos-generados';
import { M1 } from '../../pruebas/temario';
import type { Lote } from '../../tipos/generador';
import { PaginaGenerador } from './PaginaGenerador';

vi.mock('../../estado/generador', () => ({ useGenerador: vi.fn() }));
vi.mock('../../estado/textos-generados', () => ({ useTextosGenerados: vi.fn() }));

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
    uso: { hoy: { usadas: 40, maximo: 100 }, mes: { gastadoUsd: 3.2, maximoUsd: 10 } },
    resultado: {
      tipo: 'lista',
      datos: {
        texto: { titulo: 'El río', contenido: 'Un texto sobre el río.' },
        preguntas: [
          { id: '7', enunciado: '¿Qué dice?', habilidad: 'Localizar', dificultadSugerida: 'Media' },
        ],
        descartes: [
          { orden: 2, habilidad: 'Evaluar', dificultad: 'dificil', motivo: 'sin_tildes' },
        ],
      },
    },
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

beforeEach(() => {
  vi.mocked(useGenerador).mockReturnValue(estado([lote]));
  vi.mocked(useTextosGenerados).mockReset();
  vi.mocked(useTextosGenerados).mockReturnValue({
    carga: { tipo: 'cargando' },
    reintentar: vi.fn(),
  });
});

describe('Generador C05', () => {
  it('HU-18.3: consulta el texto y sus preguntas al seleccionar un lote con texto ya guardado', () => {
    vi.mocked(useGenerador).mockReturnValue(estado([{ ...lote, conTexto: true }]));
    expect(dibujar()).toContain('Texto y preguntas del lote');
    expect(useTextosGenerados).toHaveBeenCalledWith('32');
  });

  it.each([
    { ...lote, conTexto: false },
    { ...lote, conTexto: true, estado: 'pendiente' as const },
    { ...lote, conTexto: true, validas: 0 },
  ])('no consulta lecturas si no hay un texto guardado ($estado, $validas válidas)', (datos) => {
    vi.mocked(useGenerador).mockReturnValue(estado([datos]));
    expect(dibujar()).not.toContain('Texto y preguntas del lote');
    expect(useTextosGenerados).not.toHaveBeenCalled();
  });

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
      'Hoy: 40 de 100 preguntas',
      'Mes: US$ 3,20 de 10',
      'Selección múltiple',
      'Texto de lectura: El río',
      'Un texto sobre el río.',
      '¿Qué dice?',
      'Borrador creado',
      'Pregunta 2',
      'Difícil',
      'Descartada: El texto venía sin tildes',
    ]) {
      expect(html).toContain(texto);
    }
    expect(html).toContain('/banco?prueba=2&amp;eje=11&amp;contenido=110');
    expect(html).toContain('href="/banco/7"');
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
