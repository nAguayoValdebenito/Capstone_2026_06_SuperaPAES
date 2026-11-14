// @vitest-environment jsdom
// D03 · Clasificar dificultad (HU-25.2, CU-19a) con interacción real: el hook useClasificacionDocente,
// los componentes y el cliente HTTP son los de verdad; solo se reemplaza fetch, que responde como la API.
// Carga, error con reintento, vacío final, clic y atajo que guardan y avanzan, saltar, error al guardar
// que no avanza, foco en el primer botón y la salida a la revisión con la pauta (D01).
import { act } from 'react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import {
  api,
  esperar,
  pulsar,
  respuestaDeError,
  type RespuestaFalsa,
  usarPantallaDePrueba,
} from '../../pruebas/interaccion';
import type { PreguntaAClasificar } from '../../tipos';
import { ClasificacionDocente } from './ClasificacionDocente';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const RUTA = '/admin/revision/clasificar';

const pregunta = (id: number, preguntaId: number, enunciado: string): PreguntaAClasificar => ({
  id,
  preguntaId,
  ronda: 1,
  prueba: { codigo: 'M1', nombre: 'Competencia Matemática 1' },
  eje: 'Probabilidad y estadística',
  contenido: 'Medidas de posición',
  habilidad: 'Resolver problemas',
  venceEn: '2026-11-16T15:00:00.000Z',
  enunciado,
  explicacion: 'El valor central es 3.',
  alternativas: [
    { id: 1, letra: 'A', texto: '1', explicacion: null, esCorrecta: false },
    { id: 2, letra: 'B', texto: '3', explicacion: null, esCorrecta: true },
    { id: 3, letra: 'C', texto: '4', explicacion: null, esCorrecta: false },
    { id: 4, letra: 'D', texto: '8', explicacion: null, esCorrecta: false },
  ],
  texto: null,
  dificultades: [
    { codigo: 'facil', nombre: 'Fácil' },
    { codigo: 'media', nombre: 'Media' },
    { codigo: 'dificil', nombre: 'Difícil' },
  ],
});

const PRIMERA = pregunta(900, 118, '¿Cuál es la mediana de 1, 3 y 8?');
const SEGUNDA = pregunta(901, 119, '¿Cuál es la moda de 2, 2 y 5?');

const ok = (data: unknown): RespuestaFalsa => ({ cuerpo: { data, error: null, meta: null } });
const siguiente = (p: PreguntaAClasificar | null, quedan: number) => ok({ pregunta: p, quedan });
const guardada = (p: PreguntaAClasificar, dificultad: string, sigue: PreguntaAClasificar | null) =>
  ok({
    guardada: { asignacionId: p.id, preguntaId: p.preguntaId, dificultad },
    siguiente: { pregunta: sigue, quedan: sigue ? 1 : 0 },
  });
const error = respuestaDeError;

const pantalla = usarPantallaDePrueba();

async function montar() {
  act(() =>
    pantalla.raiz.render(
      <MemoryRouter>
        <ClasificacionDocente />
      </MemoryRouter>,
    ),
  );
  await esperar();
}

const texto = () => pantalla.contenedor.textContent ?? '';
const boton = (etiqueta: string) =>
  [...pantalla.contenedor.querySelectorAll('button')].find((b) =>
    b.textContent?.startsWith(etiqueta),
  )!;
const estado = () => pantalla.contenedor.querySelector('[role="status"]')?.textContent;

/** Una tecla en el documento, como la que escucha el atajo (con Ctrl si se indica). */
async function teclaGlobal(key: string, ctrlKey = false) {
  act(() => {
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key, ctrlKey, bubbles: true }));
  });
  await esperar();
}

describe('pregunta por clasificar (HU-25 esc. 1)', () => {
  it('avisa que carga y luego muestra la pregunta completa, el contador y los tres botones', async () => {
    const llamadas = api(siguiente(PRIMERA, 12));
    act(() =>
      pantalla.raiz.render(
        <MemoryRouter>
          <ClasificacionDocente />
        </MemoryRouter>,
      ),
    );
    expect(texto()).toContain('Cargando la pregunta…');
    await esperar();

    expect(llamadas[0]).toMatchObject({ metodo: 'GET', ruta: `${RUTA}/siguiente` });
    expect(texto()).toContain('Quedan 12 por clasificar');
    expect(texto()).toContain('¿Cuál es la mediana de 1, 3 y 8?');
    expect(texto()).toContain('Medidas de posición');
    expect(texto()).toContain('Importada');
    expect(
      pantalla.contenedor.querySelector('.revision-alternativa--correcta')?.textContent,
    ).toContain('3');
    expect(['Fácil', 'Media', 'Difícil'].map((n) => boton(n).textContent)).toEqual([
      'Fácil1',
      'Media2',
      'Difícil3',
    ]);
    expect(boton('Fácil').getAttribute('aria-keyshortcuts')).toBe('1');
    expect(texto()).toContain('apruebas la pregunta con esa dificultad');
    expect(document.activeElement).toBe(boton('Fácil'));
    expect(texto()).not.toMatch(/sugerida/i);
  });

  it('con una sola pendiente usa el singular', async () => {
    api(siguiente(PRIMERA, 1));
    await montar();

    expect(texto()).toContain('Queda 1 por clasificar');
  });

  it('sin preguntas muestra el vacío final', async () => {
    api(siguiente(null, 0));
    await montar();

    expect(texto()).toContain('No quedan preguntas por clasificar.');
    expect(pantalla.contenedor.querySelector('.clasificar__botones')).toBeNull();
  });

  it('si la carga falla muestra el error y Reintentar vuelve a pedir la pregunta', async () => {
    const llamadas = api(error(500, 'ERROR_INTERNO', 'Falló la carga.'), siguiente(PRIMERA, 2));
    await montar();
    expect(pantalla.contenedor.querySelector('[role="alert"]')?.textContent).toContain(
      'Falló la carga.',
    );

    await pulsar(boton('Reintentar'));

    expect(llamadas).toHaveLength(2);
    expect(texto()).toContain('¿Cuál es la mediana de 1, 3 y 8?');
  });

  it('Revisar con la pauta lleva a la misma asignación en Mis revisiones', async () => {
    api(siguiente(PRIMERA, 2));
    await montar();

    const enlace = [...pantalla.contenedor.querySelectorAll('a')].find(
      (a) => a.textContent === 'Revisar con la pauta',
    );
    expect(enlace?.getAttribute('href')).toBe('/revision?asignacion=900');
  });
});

describe('clasificar con un clic (HU-25 esc. 1, CU-19a)', () => {
  it('el clic guarda la dificultad, avisa, pasa a la siguiente y devuelve el foco al primer botón', async () => {
    const llamadas = api(siguiente(PRIMERA, 2), guardada(PRIMERA, 'media', SEGUNDA));
    await montar();

    await pulsar(boton('Media'));

    expect(llamadas[1]).toEqual({
      metodo: 'POST',
      ruta: `${RUTA}/900`,
      cuerpo: { dificultad: 'media' },
    });
    expect(estado()).toBe('Pregunta 118 guardada como Media.');
    expect(texto()).toContain('¿Cuál es la moda de 2, 2 y 5?');
    expect(texto()).toContain('Queda 1 por clasificar');
    expect(document.activeElement).toBe(boton('Fácil'));
  });

  it('las teclas 1, 2 y 3 clasifican; con Ctrl no', async () => {
    const llamadas = api(siguiente(PRIMERA, 2), guardada(PRIMERA, 'dificil', null));
    await montar();

    await teclaGlobal('3', true);
    expect(llamadas).toHaveLength(1);

    await teclaGlobal('3');

    expect(llamadas[1]).toMatchObject({ ruta: `${RUTA}/900`, cuerpo: { dificultad: 'dificil' } });
    expect(texto()).toContain('No quedan preguntas por clasificar.');
    expect(estado()).toBe('Pregunta 118 guardada como Difícil.');
  });

  it('una tecla mientras guarda no guarda dos veces', async () => {
    const llamadas = api(siguiente(PRIMERA, 2), guardada(PRIMERA, 'facil', SEGUNDA));
    await montar();

    act(() => {
      boton('Fácil').click();
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: '2', bubbles: true }));
    });
    await esperar();

    expect(llamadas.filter((l) => l.metodo === 'POST')).toHaveLength(1);
  });

  it('Saltar pide la siguiente después de la abierta, sin guardar', async () => {
    const llamadas = api(siguiente(PRIMERA, 2), siguiente(SEGUNDA, 2));
    await montar();

    await pulsar(boton('Saltar'));

    expect(llamadas[1]).toMatchObject({ metodo: 'GET', ruta: `${RUTA}/siguiente?despuesDe=900` });
    expect(texto()).toContain('¿Cuál es la moda de 2, 2 y 5?');
    expect(texto()).toContain('Quedan 2 por clasificar');
  });

  it('si guardar falla no avanza y muestra el error', async () => {
    api(siguiente(PRIMERA, 2), error(409, 'CONFLICTO', 'Esta pregunta ya se clasificó.'));
    await montar();

    await pulsar(boton('Difícil'));

    expect(pantalla.contenedor.querySelector('[role="alert"]')?.textContent).toContain(
      'Esta pregunta ya se clasificó.',
    );
    expect(texto()).toContain('¿Cuál es la mediana de 1, 3 y 8?');
    expect(estado()).toBeFalsy();
  });
});
