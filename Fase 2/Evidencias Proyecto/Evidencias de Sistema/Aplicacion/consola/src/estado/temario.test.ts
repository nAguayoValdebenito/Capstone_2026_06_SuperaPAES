import { afterEach, describe, expect, it, vi } from 'vitest';
import { TEMARIO_CONSULTA } from '../pruebas/temario-consulta';
import { responderUnaVez } from '../pruebas/sesion';
import { consultarTemario } from '../servicios/temario';
import { contarTemario, FILTROS_TEMARIO, filtrarTemario } from './temario';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('consulta de Temario C07', () => {
  it('pide el catálogo a admin y permite cancelar la petición', async () => {
    responderUnaVez({ data: TEMARIO_CONSULTA, error: null, meta: null });
    const control = new AbortController();
    expect(await consultarTemario(control.signal)).toEqual(TEMARIO_CONSULTA);
    expect(vi.mocked(fetch).mock.calls[0]?.[0]).toMatch(/\/api\/v1\/admin\/temario$/);
    expect(vi.mocked(fetch).mock.calls[0]?.[1]?.signal).toBe(control.signal);
  });

  it('propaga el error de conexión para mostrarlo y reintentar', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('sin red')));
    await expect(consultarTemario()).rejects.toMatchObject({ codigo: 'SIN_CONEXION' });
  });

  it('cuenta los contenidos reales y conserva los inactivos', () => {
    expect(contarTemario(TEMARIO_CONSULTA.pruebas)).toEqual({ pruebas: 2, ejes: 3, contenidos: 3 });
    expect(filtrarTemario(TEMARIO_CONSULTA.pruebas, FILTROS_TEMARIO)).toEqual(
      TEMARIO_CONSULTA.pruebas,
    );
  });

  it('combina prueba y área sin atribuir contenidos a otra prueba', () => {
    const filtros = { ...FILTROS_TEMARIO, pruebaId: 2, areaId: 1 };
    expect(filtrarTemario(TEMARIO_CONSULTA.pruebas, filtros)).toEqual([]);
    const resultado = filtrarTemario(TEMARIO_CONSULTA.pruebas, { ...filtros, areaId: 2 });
    expect(resultado.map((p) => p.codigo)).toEqual(['M1']);
  });

  it.each(['  ALGEBRA ', 'ecuaciones', 'comparar resultados', 'modelar', 'matematica'])(
    'busca sin tildes ni diferencias de mayúsculas: %s',
    (texto) => {
      const resultado = filtrarTemario(TEMARIO_CONSULTA.pruebas, { ...FILTROS_TEMARIO, texto });
      expect(resultado.map((p) => p.codigo)).toEqual(['M1']);
    },
  );

  it('reduce los ejes y contenidos al buscar un contenido y no muta los datos', () => {
    const copia = structuredClone(TEMARIO_CONSULTA);
    const resultado = filtrarTemario(TEMARIO_CONSULTA.pruebas, {
      ...FILTROS_TEMARIO,
      texto: 'enteros',
    });
    expect(contarTemario(resultado)).toEqual({ pruebas: 1, ejes: 1, contenidos: 1 });
    expect(TEMARIO_CONSULTA).toEqual(copia);
  });

  it('no fabrica resultados cuando no hay datos o coincidencias', () => {
    expect(contarTemario([])).toEqual({ pruebas: 0, ejes: 0, contenidos: 0 });
    expect(
      filtrarTemario(TEMARIO_CONSULTA.pruebas, { ...FILTROS_TEMARIO, texto: 'inexistente' }),
    ).toEqual([]);
  });
});
