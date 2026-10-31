import { afterEach, describe, expect, it, vi } from 'vitest';
import { listarBanco } from '../servicios/preguntas';
import type { PruebaTemario } from '../tipos';
import {
  busquedaDe,
  conFiltro,
  contenidosDisponibles,
  ejesDisponibles,
  habilidadesDisponibles,
  leerBusqueda,
  totalDePaginas,
} from './banco';

import { CL, CUATRO_ALTERNATIVAS } from '../pruebas/temario';
const PRUEBAS: PruebaTemario[] = [
  {
    id: 2,
    codigo: 'M1',
    nombre: 'Matemática 1',
    ...CUATRO_ALTERNATIVAS,
    ejes: [
      { id: 10, nombre: 'Números', contenidos: [{ id: 100, nombre: 'Enteros' }] },
      { id: 11, nombre: 'Álgebra', contenidos: [{ id: 110, nombre: 'Ecuaciones' }] },
    ],
    habilidades: [{ id: 30, nombre: 'Modelar' }],
  },
  { ...CL, ejes: [], habilidades: [] },
];

describe('filtros del banco (HU-11 esc. 1)', () => {
  it('al elegir otra prueba se limpian el eje, el contenido y la habilidad', () => {
    const elegidos = { prueba: 2, eje: 10, contenido: 100, habilidad: 30, estado: 'borrador' };

    expect(conFiltro(elegidos, 'prueba', 1)).toEqual({ prueba: 1, estado: 'borrador' });
  });

  it('al elegir otro eje se limpia el contenido, y quitar un filtro lo saca', () => {
    expect(conFiltro({ prueba: 2, eje: 10, contenido: 100 }, 'eje', 11)).toEqual({
      prueba: 2,
      eje: 11,
    });
    expect(conFiltro({ prueba: 2, origen: 'ia' }, 'origen', undefined)).toEqual({ prueba: 2 });
  });

  it('cambiar el estado, el origen o la dificultad no toca el temario elegido', () => {
    const elegidos = { prueba: 2, eje: 10 };

    expect(conFiltro(elegidos, 'dificultad', 'media')).toEqual({
      ...elegidos,
      dificultad: 'media',
    });
  });

  it('el eje se elige dentro de la prueba y el contenido dentro del eje', () => {
    expect(ejesDisponibles(PRUEBAS, {})).toEqual([]);
    expect(ejesDisponibles(PRUEBAS, { prueba: 2 }).map((e) => e.nombre)).toEqual([
      'Números',
      'Álgebra',
    ]);
    expect(contenidosDisponibles(PRUEBAS, { prueba: 2 })).toEqual([]);
    expect(contenidosDisponibles(PRUEBAS, { prueba: 2, eje: 11 })).toEqual([
      { id: 110, nombre: 'Ecuaciones' },
    ]);
  });

  it('la habilidad se elige dentro de la prueba', () => {
    expect(habilidadesDisponibles(PRUEBAS, {})).toEqual([]);
    expect(habilidadesDisponibles(PRUEBAS, { prueba: 2 })).toEqual([{ id: 30, nombre: 'Modelar' }]);
  });
});

describe('filtros y página en la URL (HU-11)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('lee los filtros y la página de la URL e ignora lo que no entiende', () => {
    const busqueda = new URLSearchParams(
      'prueba=2&eje=10&habilidad=30&estado=en_revision&origen=ia&dificultad=media&pagina=3',
    );

    expect(leerBusqueda(busqueda)).toEqual({
      filtros: {
        prueba: 2,
        eje: 10,
        habilidad: 30,
        estado: 'en_revision',
        origen: 'ia',
        dificultad: 'media',
      },
      pagina: 3,
    });
    expect(leerBusqueda(new URLSearchParams('prueba=dos&origen=otro&pagina=0&orden=id'))).toEqual({
      filtros: {},
      pagina: 1,
    });
  });

  it('aplicar un filtro deja la URL en la página 1 y la API recibe ese parámetro', async () => {
    const urls: string[] = [];
    vi.stubGlobal('fetch', (url: string) => {
      urls.push(url.replace(/^.*\/api\/v1/, ''));
      const cuerpo = { data: [], error: null, meta: { pagina: 1, porPagina: 20, total: 0 } };
      return Promise.resolve(new Response(JSON.stringify(cuerpo)));
    });
    const { filtros } = leerBusqueda(new URLSearchParams('prueba=2&pagina=3'));

    const busqueda = busquedaDe(conFiltro(filtros, 'origen', 'ia'), 1);
    const leida = leerBusqueda(busqueda);
    await listarBanco(leida.filtros, leida.pagina);

    expect(busqueda.toString()).toBe('prueba=2&origen=ia');
    expect(urls).toEqual(['/admin/preguntas?prueba=2&origen=ia']);
  });

  it('cambiar de página conserva los filtros, y limpiar deja la URL sin filtros', () => {
    const { filtros } = leerBusqueda(new URLSearchParams('estado=borrador'));

    expect(busquedaDe(filtros, 2).toString()).toBe('estado=borrador&pagina=2');
    expect(busquedaDe({}, 1).toString()).toBe('');
  });
});

describe('páginas del banco (HU-11 esc. 3)', () => {
  it('cuenta las páginas; sin preguntas hay una página', () => {
    expect(totalDePaginas({ pagina: 1, porPagina: 20, total: 134 })).toBe(7);
    expect(totalDePaginas({ pagina: 1, porPagina: 20, total: 20 })).toBe(1);
    expect(totalDePaginas({ pagina: 1, porPagina: 20, total: 0 })).toBe(1);
  });
});
