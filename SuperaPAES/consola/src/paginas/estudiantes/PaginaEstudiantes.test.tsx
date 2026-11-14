// @vitest-environment jsdom
// Estudiantes C15 con interacción real: el hook useEstudiantes, los componentes y el cliente HTTP son los
// de verdad; solo se reemplaza fetch, que responde como la API. La tabla se carga sin escribir nada,
// incluye estudiantes con y sin suscripción, muestra los intereses, pagina y filtra de forma opcional.
import { act } from 'react';
import { describe, expect, it } from 'vitest';
import { conConfirmados, textoSinEstudiantes } from '../../estado/estudiantes';
import {
  api,
  escribirEn,
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
const buscador = () => pantalla.contenedor.querySelector<HTMLInputElement>('input[type="search"]')!;

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

  it('el buscador filtra por nombre o correo desde la página 1; al vaciarlo vuelve el listado general', async () => {
    const llamadas = api(
      pagina([ANA, BETO]),
      pagina([BETO]),
      pagina([ANA, BETO]),
      pagina([]),
      pagina([ANA, BETO]),
    );
    await montar();

    escribirEn(buscador(), '  beto ');
    await pulsar(boton('Buscar'));
    expect(llamadas[1]?.ruta).toBe(`${RUTA}?buscar=beto`);
    expect(filas()).toHaveLength(1);

    escribirEn(buscador(), '');
    await esperar();
    expect(llamadas[2]?.ruta).toBe(RUTA);
    expect(filas()).toHaveLength(2);

    escribirEn(buscador(), 'nadie');
    await pulsar(boton('Buscar'));
    expect(texto()).toContain(textoSinEstudiantes('nadie'));
    expect(pantalla.contenedor.querySelector('table')).toBeNull();

    await pulsar(boton('Limpiar'));
    expect(llamadas[4]?.ruta).toBe(RUTA);
    expect(buscador().value).toBe('');
    expect(filas()).toHaveLength(2);
  });

  it('sin estudiantes registrados lo dice', async () => {
    api(pagina([]));
    await montar();

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
