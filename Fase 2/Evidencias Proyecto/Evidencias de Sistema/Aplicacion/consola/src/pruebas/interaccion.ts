// Ayudantes de las pruebas de interacción real en jsdom (C12, C14): un fetch falso que responde como la
// API y guarda cada llamada, la espera a que React termine, y los clics y teclas como en el navegador.
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, vi } from 'vitest';
import { configurarToken } from '../api/cliente';
import { tokenConsola } from './sesion';

export interface RespuestaFalsa {
  cuerpo: unknown;
  estado?: number;
}

/** fetch falso: entrega las respuestas en orden y guarda método, ruta y cuerpo de cada llamada. */
export function api(...respuestas: RespuestaFalsa[]) {
  const cola = [...respuestas];
  const llamadas: { metodo: string; ruta: string; cuerpo: unknown }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init?: RequestInit) => {
      llamadas.push({
        metodo: init?.method ?? 'GET',
        ruta: url.replace(/^.*\/api\/v1/, ''),
        cuerpo: typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : undefined,
      });
      const siguiente = cola.shift();
      if (!siguiente) throw new Error(`Llamada no esperada a ${url}`);
      return Promise.resolve(
        new Response(JSON.stringify(siguiente.cuerpo), { status: siguiente.estado ?? 200 }),
      );
    }),
  );
  return llamadas;
}

/** Respuesta de error de la API con su estado HTTP, código y mensaje. */
export const respuestaDeError = (
  estado: number,
  codigo: string,
  mensaje: string,
): RespuestaFalsa => ({
  cuerpo: { data: null, error: { codigo, mensaje }, meta: null },
  estado,
});

/** Deja correr las promesas y los efectos pendientes. */
export async function esperar() {
  await act(async () => {
    for (let i = 0; i < 5; i += 1) await new Promise((listo) => setTimeout(listo, 0));
  });
}

/** Enfoca y pulsa un botón, y espera lo que dispare. */
export async function pulsar(boton: HTMLButtonElement) {
  act(() => {
    boton.focus();
    boton.click();
  });
  await esperar();
}

/** Una tecla sobre el elemento enfocado (por ejemplo Tab, Mayús+Tab o Escape). */
export async function tecla(key: string, shiftKey = false) {
  act(() => {
    document.activeElement!.dispatchEvent(
      new KeyboardEvent('keydown', { key, shiftKey, bubbles: true }),
    );
  });
  await esperar();
}

/**
 * Antes de cada prueba, una raíz de React en un contenedor del documento y la sesión de un
 * administrador; después, la desmonta y quita el fetch falso.
 */
export function usarPantallaDePrueba() {
  const pantalla = {} as { raiz: Root; contenedor: HTMLDivElement };
  beforeEach(() => {
    configurarToken(() => tokenConsola('admin'));
    pantalla.contenedor = document.createElement('div');
    document.body.append(pantalla.contenedor);
    pantalla.raiz = createRoot(pantalla.contenedor);
  });
  afterEach(() => {
    act(() => pantalla.raiz.unmount());
    pantalla.contenedor.remove();
    configurarToken(() => null);
    vi.unstubAllGlobals();
  });
  return pantalla;
}

/** Escribe como el navegador: el setter nativo de value y el evento input que escucha React. */
export function escribirEn(entrada: HTMLInputElement | HTMLTextAreaElement, valor: string) {
  const prototipo = Object.getPrototypeOf(entrada) as object;
  act(() => {
    Reflect.set(prototipo, 'value', valor, entrada);
    entrada.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
