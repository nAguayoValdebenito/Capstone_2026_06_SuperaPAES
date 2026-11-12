// Avisos de error (C13, HU-50.3): carga, error con reintento, vacío, filtros, la bandeja agrupada por
// pregunta, Resolver y Descartar, un aviso cerrado sin acciones y la confirmación fuerte para anular,
// que Escape cancela sin enviar. Las llamadas a la API llevan solo lo que corresponde.
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  alPresionarTecla,
  grupoElegido,
  textoDeAnulacion,
  textoDeImpacto,
  type EstadoAvisosError,
} from '../../estado/avisos-error';
import { primeraLlamada, responderUnaVez } from '../../pruebas/sesion';
import { impactoDeAnular } from '../../servicios/evaluaciones';
import { anularPregunta, cerrarAviso, listarAvisos } from '../../servicios/preguntas';
import type { AvisoDeError, PreguntaConAvisos } from '../../tipos/avisos-error';
import { ConfirmarAnulacion } from './ConfirmarAnulacion';
import { VistaAvisos } from './PaginaAvisosError';

afterEach(() => vi.unstubAllGlobals());

const aviso = (id: number, cambios: Partial<AvisoDeError> = {}): AvisoDeError => ({
  id,
  version: 2,
  motivo: { codigo: 'respuesta', nombre: 'La respuesta correcta está mal' },
  comentario: 'Creo que la correcta es la C.',
  estado: { codigo: 'pendiente', nombre: 'Pendiente' },
  creadoEn: '2026-10-20T15:00:00.000Z',
  resueltoEn: null,
  resueltoPor: null,
  ...cambios,
});

const grupo = (id: number, cambios: Partial<PreguntaConAvisos> = {}): PreguntaConAvisos => ({
  pregunta: {
    id,
    versionActual: 3,
    estado: { codigo: 'publicada', nombre: 'Publicada' },
    prueba: { id: 2, codigo: 'M1', nombre: 'Competencia Matemática 1' },
    contenido: { id: 110, nombre: 'Función lineal y afín' },
    resumen: '¿Cuál es la pendiente de la recta?',
  },
  pendientes: 1,
  avisos: [aviso(41)],
  ...cambios,
});

const CERRADO = aviso(43, {
  estado: { codigo: 'resuelto', nombre: 'Resuelto' },
  resueltoEn: '2026-10-21T15:00:00.000Z',
  resueltoPor: 'Ana Admin',
});

function estado(cambios: Partial<EstadoAvisosError> = {}): EstadoAvisosError {
  return {
    filtros: { estado: 'pendiente', motivo: '' },
    cambiarFiltro: vi.fn(),
    carga: {
      tipo: 'lista',
      datos: { grupos: [grupo(205)], paginacion: { pagina: 1, porPagina: 20, total: 1 } },
    },
    motivos: {
      tipo: 'lista',
      datos: [{ codigo: 'respuesta', nombre: 'La respuesta correcta está mal', activa: true }],
    },
    pagina: 1,
    setPagina: vi.fn(),
    elegida: null,
    elegir: vi.fn(),
    reintentar: vi.fn(),
    mensaje: null,
    enCurso: false,
    cerrar: vi.fn(),
    anulacion: {
      preguntaId: null,
      abrir: vi.fn(),
      cerrar: vi.fn(),
      impacto: { tipo: 'cargando' },
      confirmar: vi.fn(),
    },
    ...cambios,
  };
}

const dibujar = (e: EstadoAvisosError) =>
  renderToString(
    <MemoryRouter>
      <VistaAvisos estado={e} />
    </MemoryRouter>,
  );

describe('estados de la bandeja (C13)', () => {
  it('muestra que carga, y el error de la API con Reintentar', () => {
    const cargando = dibujar(estado({ carga: { tipo: 'cargando' } }));
    const fallida = dibujar(
      estado({ carga: { tipo: 'fallida', codigo: 'ERROR_INTERNO', mensaje: 'Falló la bandeja.' } }),
    );

    expect(cargando).toContain('Cargando avisos…');
    expect(fallida).toContain('Falló la bandeja.');
    expect(fallida).toContain('ERROR_INTERNO');
    expect(fallida).toContain('Reintentar');
    expect(fallida).not.toContain('<table');
  });

  it('sin avisos pendientes lo dice con el texto del boceto', () => {
    const vacia = estado({
      carga: {
        tipo: 'lista',
        datos: { grupos: [], paginacion: { pagina: 1, porPagina: 20, total: 0 } },
      },
    });

    expect(dibujar(vacia)).toContain('No hay avisos pendientes.');
  });

  it('ofrece los filtros por estado (pendientes por defecto) y por motivo', () => {
    const html = dibujar(estado());

    expect(html).toContain('<option value="pendiente" selected="">Pendientes</option>');
    expect(html).toContain('Descartados');
    expect(html).toContain('<option value="respuesta">La respuesta correcta está mal</option>');
  });
});

describe('bandeja y detalle de la pregunta (HU-50 esc. 1 y 2)', () => {
  it('muestra motivo, comentario, pregunta, versión, fecha y el acceso a C03', () => {
    const html = dibujar(estado());

    for (const texto of [
      'P-205',
      'La respuesta correcta está mal',
      'Creo que la correcta es la C.',
      '20-10-2026',
      'versión 2',
      '(la actual es la 3)',
      'href="/banco/205"',
      'Abrir pregunta',
      'Resolver',
      'Descartar',
      'Anular pregunta',
    ]) {
      expect(html).toContain(texto);
    }
    expect(html).not.toContain('En construcción');
  });

  it('un aviso cerrado no tiene acciones y dice quién lo cerró', () => {
    const html = dibujar(
      estado({
        carga: {
          tipo: 'lista',
          datos: {
            grupos: [grupo(205, { pendientes: 0, avisos: [CERRADO] })],
            paginacion: { pagina: 1, porPagina: 20, total: 1 },
          },
        },
      }),
    );

    expect(html).toContain('Cerrado por Ana Admin el 21-10-2026.');
    expect(html).not.toContain('Resolver');
    expect(html).not.toContain('Descartar');
  });

  it('una pregunta que ya no está publicada no ofrece anular', () => {
    const retirada = grupo(206);
    retirada.pregunta.estado = { codigo: 'retirada', nombre: 'Retirada' };
    const html = dibujar(
      estado({
        carga: {
          tipo: 'lista',
          datos: { grupos: [retirada], paginacion: { pagina: 1, porPagina: 20, total: 1 } },
        },
      }),
    );

    expect(html).not.toContain('Anular pregunta');
  });

  it('elige la pregunta indicada o, si ya no está, la primera', () => {
    const grupos = [grupo(205), grupo(206)];

    expect(grupoElegido(grupos, 206)?.pregunta.id).toBe(206);
    expect(grupoElegido(grupos, 999)?.pregunta.id).toBe(205);
    expect(grupoElegido([], null)).toBeNull();
  });

  it('anuncia el resultado de una acción', () => {
    const html = dibujar(
      estado({ mensaje: { tipo: 'exito', texto: 'Aviso resuelto. Quedó en la auditoría.' } }),
    );

    expect(html).toContain('role="status"');
    expect(html).toContain('Aviso resuelto. Quedó en la auditoría.');
  });
});

describe('confirmación para anular (HU-50 esc. 3)', () => {
  const confirmar = (impacto: Parameters<typeof ConfirmarAnulacion>[0]['impacto']) =>
    renderToString(
      <ConfirmarAnulacion
        preguntaId={205}
        impacto={impacto}
        enCurso={false}
        alConfirmar={vi.fn()}
        alCancelar={vi.fn()}
      />,
    );

  it('explica el efecto, cuenta las evaluaciones y no deja anular sin marcar que se entiende', () => {
    const html = confirmar({
      tipo: 'lista',
      datos: { evaluacionesCerradas: 41, evaluacionesAbiertas: 2 },
    });

    expect(html).toContain('role="alertdialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('¿Anular la pregunta P-205?');
    expect(html).toContain('Deja de entregarse');
    expect(html).toContain('Se recalcularán 41 evaluaciones cerradas.');
    expect(html).toContain('No se puede deshacer');
    expect(html).toMatch(/disabled=""[^>]*>Anular pregunta/);
  });

  it('mientras cuenta, o si no puede contar, lo dice', () => {
    expect(textoDeImpacto({ tipo: 'cargando' })).toBe('Contando las evaluaciones afectadas…');
    expect(textoDeImpacto({ tipo: 'fallida', codigo: 'X', mensaje: 'x' })).toBe(
      'No se pudo contar las evaluaciones afectadas.',
    );
    expect(textoDeImpacto({ tipo: 'lista', datos: { evaluacionesCerradas: 1 } })).toBe(
      'Se recalcularán 1 evaluación cerrada.',
    );
  });

  it('Escape cancela sin enviar; otras teclas no hacen nada', () => {
    const cancelar = vi.fn();

    alPresionarTecla('Enter', cancelar);
    alPresionarTecla('Escape', cancelar);

    expect(cancelar).toHaveBeenCalledTimes(1);
  });

  it('el resultado dice cuántas evaluaciones se recalcularon y cuántos avisos se resolvieron', () => {
    expect(
      textoDeAnulacion({
        preguntaId: 205,
        estado: { codigo: 'retirada', nombre: 'Retirada' },
        evaluacionesRecalculadas: 41,
        avisosCerrados: 1,
      }),
    ).toBe(
      'Pregunta anulada: ya no se entrega. Se recalcularon 41 evaluaciones y se resolvieron 1 aviso.',
    );
  });
});

describe('llamadas a la API', () => {
  it('lista con solo los filtros elegidos y la página', async () => {
    responderUnaVez({ data: [], error: null, meta: { pagina: 2, porPagina: 20, total: 21 } });

    await listarAvisos({ estado: 'todos', motivo: '' }, 2);

    expect(primeraLlamada().url).toBe('/admin/preguntas/avisos?estado=todos&pagina=2');
  });

  it('cierra un aviso con PATCH y su estado', async () => {
    responderUnaVez({ data: CERRADO, error: null, meta: null });

    await cerrarAviso(43, 'descartado');

    expect(primeraLlamada()).toEqual({
      url: '/admin/preguntas/avisos/43',
      metodo: 'PATCH',
      cuerpo: JSON.stringify({ estado: 'descartado' }),
    });
  });

  it('anula con POST y cuenta antes el impacto en evaluaciones', async () => {
    responderUnaVez({ data: {}, error: null, meta: null });
    await anularPregunta(205);
    expect(primeraLlamada()).toEqual(
      expect.objectContaining({ url: '/admin/preguntas/205/anulacion', metodo: 'POST' }),
    );

    vi.unstubAllGlobals();
    responderUnaVez({
      data: { evaluacionesCerradas: 3, evaluacionesAbiertas: 0 },
      error: null,
      meta: null,
    });
    expect(await impactoDeAnular(205)).toEqual({
      evaluacionesCerradas: 3,
      evaluacionesAbiertas: 0,
    });
    expect(primeraLlamada().url).toBe('/admin/evaluaciones/preguntas/205/impacto');
  });
});
