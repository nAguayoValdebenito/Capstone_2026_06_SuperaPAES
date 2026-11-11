import { renderToString } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCarga } from '../../estado/carga';
import { useEstructuras, useTablas } from '../../estado/evaluaciones';
import { PaginaEvaluaciones } from './PaginaEvaluaciones';

vi.mock('../../estado/carga', () => ({ useCarga: vi.fn() }));
vi.mock('../../estado/evaluaciones', () => ({ useEstructuras: vi.fn(), useTablas: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Evaluaciones sin pruebas cargadas', () => {
  it('explica el estado vacío y no consulta estructuras ni tablas con un identificador inválido', () => {
    vi.mocked(useCarga).mockReturnValue({
      tipo: 'lista',
      datos: { pruebas: [], estados: [], origenes: [], dificultades: [] },
    });

    const html = renderToString(<PaginaEvaluaciones />);

    expect(html).toContain('No hay pruebas disponibles para configurar evaluaciones.');
    expect(html).not.toContain('Cargando las estructuras');
    expect(vi.mocked(useEstructuras)).not.toHaveBeenCalled();
    expect(vi.mocked(useTablas)).not.toHaveBeenCalled();
  });

  it('con pruebas cargadas consulta las estructuras de la primera prueba y nunca del identificador 0', () => {
    const prueba = {
      id: 7,
      codigo: 'M1',
      nombre: 'Matemática 1',
      opcionesMin: 4,
      opcionesMax: 4,
      requiereTexto: false,
      ejes: [],
      habilidades: [],
      tiposPregunta: [],
    };
    vi.mocked(useCarga).mockReturnValue({
      tipo: 'lista',
      datos: { pruebas: [prueba], estados: [], origenes: [], dificultades: [] },
    });
    vi.mocked(useEstructuras).mockReturnValue({
      carga: { tipo: 'cargando' },
      editandoId: null,
      editar: vi.fn(),
      guardarEstructura: vi.fn(),
      guardando: false,
      error: null,
      aviso: null,
    } as unknown as ReturnType<typeof useEstructuras>);

    const html = renderToString(<PaginaEvaluaciones />);

    expect(html).not.toContain('No hay pruebas disponibles para configurar evaluaciones.');
    expect(vi.mocked(useEstructuras)).toHaveBeenCalledWith(7);
    expect(vi.mocked(useEstructuras)).not.toHaveBeenCalledWith(0);
  });
});
