// @vitest-environment jsdom
// Estudiantes C15 con interacción real: el hook useEstudiantes, los componentes y el cliente HTTP son los
// de verdad; solo se reemplaza fetch, que responde como la API. La tabla se carga sin escribir nada,
// incluye estudiantes con y sin suscripción, muestra los intereses, pagina y filtra con selectores. Las
// áreas de carrera del filtro Interés llegan de las listas de opciones.
import { act } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { conConfirmados, SIN_FILTROS, textoSinEstudiantes } from '../../estado/estudiantes';
import {
  api as apiDelListado,
  esperar,
  pulsar,
  respuestaDeError,
  usarPantallaDePrueba,
  type RespuestaFalsa,
} from '../../pruebas/interaccion';
import type { EstudianteConsola } from '../../tipos/estudiantes';
import { PaginaEstudiantes } from './PaginaEstudiantes';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const RUTA = '/admin/cuentas/estudiantes';

const estudiante = (id: number, cambios: Partial<EstudianteConsola> = {}): EstudianteConsola => ({
  id,
  nombre: `Estudiante ${String(id)}`,
  correo: `e${String(id)}@ejemplo.cl`,
  correoVerificado: true,
  suscripcionActiva: false,
  intereses: [],
  ...cambios,
});

const ANA = estudiante(7, {
  nombre: 'Ana Pérez Soto',
  correo: 'ana@ejemplo.cl',
  suscripcionActiva: true,
  intereses: ['Salud', 'Educación'],
});
const BETO = estudiante(8, {
  nombre: 'Beto Rojas',
  correo: 'beto@ejemplo.cl',
  correoVerificado: false,
});

const pagina = (estudiantes: EstudianteConsola[], numero = 1, total = estudiantes.length) =>
  ({
    cuerpo: { data: estudiantes, error: null, meta: { pagina: numero, porPagina: 20, total } },
  }) satisfies RespuestaFalsa;

const LISTAS = {
  data: {
    areasCarrera: [
      { codigo: 'salud', nombre: 'Salud', activa: true, pruebas: [], electivo: null },
      { codigo: 'educacion', nombre: 'Educación', activa: true, pruebas: [], electivo: null },
    ],
  },
  error: null,
  meta: null,
};

/**
 * fetch falso: las listas de opciones responden siempre lo mismo y las llamadas al listado (y a la
 * confirmación) se responden en orden y quedan guardadas.
 */
function api(...respuestas: RespuestaFalsa[]) {
  const llamadas = apiDelListado(...respuestas);
  const delListado = vi.mocked(fetch);
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init?: RequestInit) =>
      url.includes('/temario/listas-opciones')
        ? Promise.resolve(new Response(JSON.stringify(LISTAS)))
        : delListado(url, init),
    ),
  );
  return llamadas;
}

const pantalla = usarPantallaDePrueba();

async function montar() {
  act(() => pantalla.raiz.render(<PaginaEstudiantes />));
  await esperar();
}

const texto = () => pantalla.contenedor.textContent ?? '';
const boton = (etiqueta: string) =>
  [...pantalla.contenedor.querySelectorAll('button')].find((b) => b.textContent === etiqueta)!;
const filas = () =>
  [...pantalla.contenedor.querySelectorAll('tbody tr')].map((fila) =>
    [...fila.querySelectorAll('th, td')].map((celda) => celda.textContent),
  );
const selector = (etiqueta: string) =>
  [...pantalla.contenedor.querySelectorAll('label')]
    .find((label) => label.firstChild?.textContent === etiqueta)!
    .querySelector('select')!;

/** Elige una opción como el navegador: el setter nativo de value y el evento change. */
async function elegir(etiqueta: string, valor: string) {
  const lista = selector(etiqueta);
  act(() => {
    Reflect.set(HTMLSelectElement.prototype, 'value', valor, lista);
    lista.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await esperar();
}

describe('listado de estudiantes (C15)', () => {
  it('se carga al entrar, sin escribir nada, con suscripción e intereses de cada estudiante', async () => {
    const llamadas = api(pagina([ANA, BETO]));
    act(() => pantalla.raiz.render(<PaginaEstudiantes />));
    expect(texto()).toContain('Cargando estudiantes…');
    await esperar();

    expect(llamadas).toEqual([{ metodo: 'GET', ruta: RUTA, cuerpo: undefined }]);
    expect(filas()).toEqual([
      ['Ana Pérez Soto', 'ana@ejemplo.cl', 'Activa', 'Salud, Educación', 'Verificada'],
      [
        'Beto Rojas',
        'beto@ejemplo.cl',
        'Sin suscripción activa',
        'Sin intereses registrados',
        'Confirmar cuenta',
      ],
    ]);
    expect(texto()).toContain('Página 1 de 1 · 1–2 de 2');
  });

  it('pasa de página pidiéndola a la API', async () => {
    const primera = Array.from({ length: 20 }, (_, i) => estudiante(100 - i));
    const llamadas = api(pagina(primera, 1, 21), pagina([estudiante(1)], 2, 21));
    await montar();
    expect(texto()).toContain('Página 1 de 2 · 1–20 de 21');

    await pulsar(boton('Siguiente'));

    expect(llamadas[1]?.ruta).toBe(`${RUTA}?pagina=2`);
    expect(filas()).toHaveLength(1);
    expect(texto()).toContain('Página 2 de 2 · 21–21 de 21');
  });

  it('filtra con selectores desde la página 1 y «Limpiar filtros» vuelve al listado general', async () => {
    const llamadas = api(
      pagina([ANA, BETO]),
      pagina([ANA]),
      pagina([ANA]),
      pagina([]),
      pagina([ANA, BETO]),
    );
    await montar();
    expect([...selector('Interés').options].map((opcion) => opcion.text)).toEqual([
      'Todos',
      'Salud',
      'Educación',
      'Sin intereses registrados',
    ]);
    expect(pantalla.contenedor.querySelector('input')).toBeNull();

    await elegir('Suscripción', 'activa');
    expect(llamadas[1]?.ruta).toBe(`${RUTA}?suscripcion=activa`);
    expect(filas()).toHaveLength(1);

    await elegir('Interés', 'salud');
    expect(llamadas[2]?.ruta).toBe(`${RUTA}?suscripcion=activa&interes=salud`);

    await elegir('Cuenta', 'no');
    expect(llamadas[3]?.ruta).toBe(`${RUTA}?suscripcion=activa&interes=salud&verificado=no`);
    expect(texto()).toContain('No hay estudiantes con esos filtros.');
    expect(pantalla.contenedor.querySelector('table')).toBeNull();

    await pulsar(boton('Limpiar filtros'));
    expect(llamadas[4]?.ruta).toBe(RUTA);
    expect(selector('Suscripción').value).toBe('');
    expect(filas()).toHaveLength(2);
  });

  it('sin estudiantes registrados lo dice', async () => {
    api(pagina([]));
    await montar();

    expect(texto()).toContain(textoSinEstudiantes(SIN_FILTROS));
    expect(texto()).toContain('Todavía no hay estudiantes registrados.');
    expect(pantalla.contenedor.querySelector('table')).toBeNull();
  });

  it('si la carga falla muestra el error y Reintentar vuelve a pedir el listado', async () => {
    const llamadas = api(
      respuestaDeError(500, 'ERROR_INTERNO', 'No se pudo cargar el listado.'),
      pagina([ANA]),
    );
    await montar();
    expect(texto()).toContain('No se pudo cargar el listado.');

    await pulsar(boton('Reintentar'));

    expect(llamadas).toHaveLength(2);
    expect(filas()).toHaveLength(1);
  });

  it('confirma la cuenta de un estudiante sin verificar y la fila lo refleja sin recargar', async () => {
    const llamadas = api(pagina([ANA, BETO]), {
      cuerpo: { data: { id: 8, correoVerificado: true }, error: null, meta: null },
    });
    await montar();

    await pulsar(boton('Confirmar cuenta'));

    expect(llamadas[1]).toMatchObject({ metodo: 'POST', ruta: `${RUTA}/8/confirmar-correo` });
    expect(texto()).toContain('Cuenta confirmada.');
    expect(filas()[1]?.[4]).toBe('Verificada');
    expect(llamadas).toHaveLength(2);
  });
});

describe('ayudantes del listado', () => {
  it('marca como verificados solo a los confirmados', () => {
    const lista = conConfirmados(
      [ANA, BETO, estudiante(9, { correoVerificado: false })],
      new Set([8]),
    );

    expect(lista.map((e) => e.correoVerificado)).toEqual([true, true, false]);
  });
});
