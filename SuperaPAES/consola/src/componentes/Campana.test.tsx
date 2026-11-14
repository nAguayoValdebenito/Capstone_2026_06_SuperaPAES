// @vitest-environment jsdom
// La campana lista lo que espera acción (los contadores del menú), se cierra con Escape devolviendo
// el foco al botón y con un clic fuera.
import { act } from 'react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { pulsar, tecla, usarPantallaDePrueba } from '../pruebas/interaccion';
import { Campana } from './Campana';

const pantalla = usarPantallaDePrueba();
const boton = () => pantalla.contenedor.querySelector('button')!;
const panel = () => pantalla.contenedor.querySelector('#campana-panel');

function dibujar(contadores: Record<string, { valor: number; alerta: boolean }>) {
  act(() =>
    pantalla.raiz.render(
      <MemoryRouter>
        <Campana contadores={contadores} />
      </MemoryRouter>,
    ),
  );
}

describe('Campana: requiere atención', () => {
  it('sin pendientes avisa que no hay nada y no marca el botón', async () => {
    dibujar({ '/solicitudes-datos': { valor: 0, alerta: false } });
    expect(boton().getAttribute('aria-label')).toBe('Requiere atención');
    await pulsar(boton());
    expect(panel()!.textContent).toContain('No hay nada pendiente.');
  });

  it('lista primero lo que pide acción, con su sección', async () => {
    dibujar({
      '/solicitudes-datos': { valor: 2, alerta: false },
      '/avisos-error': { valor: 3, alerta: true },
    });
    expect(boton().getAttribute('aria-label')).toBe('Requiere atención (2)');
    await pulsar(boton());
    const filas = [...panel()!.querySelectorAll('li')].map((li) => li.textContent);
    expect(filas[0]).toContain('3 avisos de error pendientes');
    expect(filas[0]).toContain('Pide acción');
    expect(filas[1]).toContain('2 solicitudes de datos pendientes');
    expect(panel()!.querySelector('a')!.getAttribute('href')).toBe('/avisos-error');
  });

  it('Escape cierra y devuelve el foco al botón; un clic fuera también cierra', async () => {
    dibujar({ '/avisos-error': { valor: 1, alerta: true } });
    await pulsar(boton());
    expect(panel()).not.toBeNull();
    await tecla('Escape');
    expect(panel()).toBeNull();
    expect(document.activeElement).toBe(boton());

    await pulsar(boton());
    act(() => {
      document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    });
    expect(panel()).toBeNull();
  });
});
