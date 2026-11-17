// @vitest-environment jsdom
// Pestañas con el patrón WAI-ARIA (prompt 4): la elegida es la única en el recorrido de Tab y las
// flechas, Inicio y Fin cambian de pestaña y mueven el foco.
import { act, useState } from 'react';
import { describe, expect, it } from 'vitest';
import { tecla, usarPantallaDePrueba } from '../pruebas/interaccion';
import { Pestanas } from './Pestanas';

const OPCIONES = [
  { valor: 'curso', texto: 'En curso' },
  { valor: 'desempate', texto: 'En desempate' },
  { valor: 'vencidas', texto: 'Vencidas' },
] as const;

function Prueba() {
  const [valor, cambiar] = useState<string>('curso');
  return (
    <Pestanas etiqueta="Grupos" opciones={OPCIONES} valor={valor} alElegir={cambiar}>
      <p>Contenido de {valor}</p>
    </Pestanas>
  );
}

const pantalla = usarPantallaDePrueba();
const pestanas = () => [...pantalla.contenedor.querySelectorAll<HTMLElement>('[role="tab"]')];
const elegida = () => pestanas().find((p) => p.getAttribute('aria-selected') === 'true')!;

describe('Pestanas', () => {
  it('marca la elegida con aria-selected, tabindex itinerante y su tabpanel', () => {
    act(() => pantalla.raiz.render(<Prueba />));
    expect(pantalla.contenedor.querySelector('[role="tablist"]')!.getAttribute('aria-label')).toBe(
      'Grupos',
    );
    expect(pestanas().map((p) => p.tabIndex)).toEqual([0, -1, -1]);
    const panel = pantalla.contenedor.querySelector('[role="tabpanel"]')!;
    expect(panel.getAttribute('aria-labelledby')).toBe(elegida().id);
    expect(pestanas()[0]!.getAttribute('aria-controls')).toBe(panel.id);
    expect(panel.textContent).toBe('Contenido de curso');
  });

  it('las flechas recorren en círculo; Inicio y Fin van a los extremos', async () => {
    act(() => pantalla.raiz.render(<Prueba />));
    act(() => pestanas()[0]!.focus());
    await tecla('ArrowRight');
    expect(elegida().textContent).toBe('En desempate');
    expect(document.activeElement).toBe(elegida());
    await tecla('End');
    expect(elegida().textContent).toBe('Vencidas');
    await tecla('ArrowRight');
    expect(elegida().textContent).toBe('En curso');
    await tecla('ArrowLeft');
    expect(elegida().textContent).toBe('Vencidas');
    await tecla('Home');
    expect(elegida().textContent).toBe('En curso');
    expect(pestanas().map((p) => p.tabIndex)).toEqual([0, -1, -1]);
  });
});
