// Suscripciones (C16, HU-56): la vista vive en la URL y las llamadas a la API llevan solo los filtros
// elegidos.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { primeraLlamada, responderUnaVez } from '../pruebas/sesion';
import {
  listarAvisosConError,
  listarSuscripciones,
  obtenerResumenSuscripciones,
  obtenerSuscripcion,
} from '../servicios/suscripciones';
import { busquedaDe, conFiltro, leerVista } from './suscripciones';

afterEach(() => vi.unstubAllGlobals());

const vacia = { filtros: {}, pagina: 1 };

describe('la vista de las suscripciones en la URL (HU-56 esc. 2)', () => {
  it('lee los filtros, la página, la suscripción elegida y la bandeja de avisos', () => {
    const vista = leerVista(
      new URLSearchParams(
        'estado=en_mora&plan=3&desde=2026-10-01&hasta=2026-10-20&correo=+ana+&pagina=2&ver=12&avisos=1',
      ),
    );

    expect(vista).toEqual({
      filtros: {
        estado: 'en_mora',
        plan: 3,
        desde: '2026-10-01',
        hasta: '2026-10-20',
        correo: 'ana',
      },
      pagina: 2,
      ver: 12,
      avisos: 1,
    });
  });

  it('ignora lo que no entiende', () => {
    expect(
      leerVista(new URLSearchParams('estado=Activa!&plan=0&desde=20-10-2026&ver=x&pagina=-1')),
    ).toEqual(vacia);
  });

  it('escribe la URL como la consulta de la API, sin la página 1', () => {
    expect(busquedaDe(vacia).toString()).toBe('');
    expect(
      busquedaDe({ filtros: { estado: 'activa', correo: 'ana@' }, pagina: 3, ver: 7 }).toString(),
    ).toBe('estado=activa&correo=ana%40&pagina=3&ver=7');
  });

  it('cambiar un filtro vuelve a la primera página; vaciarlo lo quita', () => {
    const vista = { filtros: { estado: 'activa', plan: 2 }, pagina: 4, ver: 9 };

    expect(conFiltro(vista, 'plan', 3)).toEqual({
      ...vista,
      filtros: { estado: 'activa', plan: 3 },
      pagina: 1,
    });
    expect(conFiltro(vista, 'estado', '')).toEqual({ ...vista, filtros: { plan: 2 }, pagina: 1 });
  });
});

describe('llamadas a /admin/suscripciones', () => {
  it('pide la lista con los filtros y lee la paginación de meta', async () => {
    responderUnaVez({ data: [], error: null, meta: { pagina: 2, porPagina: 20, total: 21 } });

    const pagina = await listarSuscripciones({ plan: 3, correo: 'ana' }, 2);

    expect(primeraLlamada().url).toBe('/admin/suscripciones/?plan=3&correo=ana&pagina=2');
    expect(pagina).toEqual({
      suscripciones: [],
      paginacion: { pagina: 2, porPagina: 20, total: 21 },
    });
  });

  it('pide el resumen, el detalle y la página de avisos con error', async () => {
    responderUnaVez({ data: { activas: 1 }, error: null, meta: null });
    await obtenerResumenSuscripciones();
    expect(primeraLlamada().url).toBe('/admin/suscripciones/resumen');

    responderUnaVez({ data: { id: 12 }, error: null, meta: null });
    await obtenerSuscripcion(12);
    expect(primeraLlamada().url).toBe('/admin/suscripciones/12');

    responderUnaVez({ data: [], error: null, meta: null });
    const avisos = await listarAvisosConError(2);
    expect(primeraLlamada().url).toBe('/admin/suscripciones/avisos-error?pagina=2');
    expect(avisos.paginacion).toEqual({ pagina: 2, porPagina: 0, total: 0 });
  });
});
