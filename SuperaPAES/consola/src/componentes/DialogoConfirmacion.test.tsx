// @vitest-environment jsdom
// Diálogo de confirmación (prompt 4): se abre como modal, Escape y «Cancelar» cancelan, y confirmar
// ejecuta la acción una sola vez.
import { act, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { pulsar, tecla, usarPantallaDePrueba } from '../pruebas/interaccion';
import { DialogoConfirmacion } from './DialogoConfirmacion';

function Prueba({ alConfirmar }: { alConfirmar: () => void }) {
  const [abierto, cambiar] = useState(false);
  return (
    <>
      <button type="button" onClick={() => cambiar(true)}>
        Retirar
      </button>
      <DialogoConfirmacion
        abierto={abierto}
        titulo="¿Retirar la pregunta P-0084?"
        textoConfirmar="Retirar"
        peligro
        alConfirmar={() => {
          alConfirmar();
          cambiar(false);
        }}
        alCancelar={() => cambiar(false)}
      >
        <p>Deja de llegar a la app.</p>
      </DialogoConfirmacion>
    </>
  );
}

const pantalla = usarPantallaDePrueba();
const dialogo = () => pantalla.contenedor.querySelector('dialog')!;
const boton = (texto: string, dentro: ParentNode = pantalla.contenedor) =>
  [...dentro.querySelectorAll('button')].find((b) => b.textContent === texto)!;

async function abrir(alConfirmar = vi.fn()) {
  act(() => pantalla.raiz.render(<Prueba alConfirmar={alConfirmar} />));
  await pulsar(boton('Retirar'));
  return alConfirmar;
}

describe('DialogoConfirmacion', () => {
  it('cerrado no muestra contenido; al abrir muestra título, consecuencia y la acción en granate', async () => {
    act(() => pantalla.raiz.render(<Prueba alConfirmar={vi.fn()} />));
    expect(dialogo().hasAttribute('open')).toBe(false);
    expect(dialogo().textContent).toBe('');
    await abrir();
    expect(dialogo().hasAttribute('open')).toBe(true);
    expect(dialogo().textContent).toContain('¿Retirar la pregunta P-0084?');
    expect(dialogo().textContent).toContain('Deja de llegar a la app.');
    expect(boton('Retirar', dialogo()).className).toBe('boton boton--peligro-solido');
    expect(dialogo().getAttribute('aria-labelledby')).toBe(dialogo().querySelector('h2')!.id);
  });

  it('Escape cancela sin ejecutar la acción', async () => {
    const alConfirmar = await abrir();
    boton('Cancelar', dialogo()).focus();
    await tecla('Escape');
    expect(dialogo().hasAttribute('open')).toBe(false);
    expect(alConfirmar).not.toHaveBeenCalled();
  });

  it('Cancelar cierra y confirmar ejecuta la acción una vez', async () => {
    const alConfirmar = await abrir();
    await pulsar(boton('Cancelar', dialogo()));
    expect(alConfirmar).not.toHaveBeenCalled();
    await pulsar(boton('Retirar'));
    await pulsar(boton('Retirar', dialogo()));
    expect(alConfirmar).toHaveBeenCalledTimes(1);
    expect(dialogo().hasAttribute('open')).toBe(false);
  });
});
