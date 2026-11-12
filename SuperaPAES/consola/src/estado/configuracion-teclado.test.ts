import type { KeyboardEvent, RefObject } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { manejarTeclaConfiguracion } from './configuracion-teclado';

function evento(key: string, shiftKey = false, prevenir = vi.fn()) {
  return { key, shiftKey, preventDefault: prevenir } as unknown as KeyboardEvent;
}

const boton = (enfocar = vi.fn()) => ({ focus: enfocar }) as unknown as HTMLButtonElement;
const ref = (current: HTMLButtonElement): RefObject<HTMLButtonElement> => ({ current });

afterEach(() => vi.unstubAllGlobals());

describe('teclado de confirmación C12', () => {
  it('Escape cancela cuando no se está guardando', () => {
    const cancelar = vi.fn();
    const controles = { cancelar: ref(boton()), aceptar: ref(boton()) };
    manejarTeclaConfiguracion(evento('Escape'), controles, false, cancelar);
    expect(cancelar).toHaveBeenCalledOnce();
    manejarTeclaConfiguracion(evento('Escape'), controles, true, cancelar);
    expect(cancelar).toHaveBeenCalledOnce();
  });

  it('Tab mantiene el foco dentro del diálogo en ambos sentidos', () => {
    const focoCancelar = vi.fn();
    const focoAceptar = vi.fn();
    const controles = { cancelar: ref(boton(focoCancelar)), aceptar: ref(boton(focoAceptar)) };
    vi.stubGlobal('document', { activeElement: controles.cancelar.current });
    const prevenirAtras = vi.fn();
    const atras = evento('Tab', true, prevenirAtras);
    manejarTeclaConfiguracion(atras, controles, false, vi.fn());
    expect(prevenirAtras).toHaveBeenCalledOnce();
    expect(focoAceptar).toHaveBeenCalledOnce();
    vi.stubGlobal('document', { activeElement: controles.aceptar.current });
    const prevenirAdelante = vi.fn();
    const adelante = evento('Tab', false, prevenirAdelante);
    manejarTeclaConfiguracion(adelante, controles, false, vi.fn());
    expect(prevenirAdelante).toHaveBeenCalledOnce();
    expect(focoCancelar).toHaveBeenCalledOnce();
  });
});
