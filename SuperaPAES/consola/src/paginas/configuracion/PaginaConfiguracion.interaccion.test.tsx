// @vitest-environment jsdom
// Configuración C12 (HU-51.2) con interacción real: el hook useConfiguracion, los componentes y el
// cliente HTTP son los de verdad; solo se reemplaza fetch, que responde como la API.
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { configurarToken } from '../../api/cliente';
import { api, esperar, pulsar, tecla, type RespuestaFalsa } from '../../pruebas/interaccion';
import { tokenConsola } from '../../pruebas/sesion';
import type { ParametroConfiguracion } from '../../tipos/configuracion';
import { PaginaConfiguracion } from './PaginaConfiguracion';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const CUPO: ParametroConfiguracion = {
  clave: 'cupo_inicial',
  nombre: 'Cupo diario sin correo verificado',
  descripcion: 'Preguntas diarias de un estudiante sin correo verificado.',
  valor: 10,
  unidad: 'preguntas',
  editable: true,
  regla: 'RN-01',
  actualizadoEn: '2026-11-12T12:00:00.000Z',
  actualizadoPor: null,
};
const UMBRAL: ParametroConfiguracion = {
  ...CUPO,
  clave: 'umbral_eje_debil',
  nombre: 'Umbral de eje a reforzar',
  valor: 60,
  unidad: '%',
  regla: 'RN-14',
};
const MODELO: ParametroConfiguracion = {
  ...CUPO,
  clave: 'modelo_ia',
  nombre: 'Modelo de IA',
  valor: 'modelo-de-prueba',
  unidad: '',
  editable: false,
  regla: 'RF-G03',
};

const exito = (data: unknown): RespuestaFalsa => ({ cuerpo: { data, error: null, meta: null } });
const lista = (parametros: ParametroConfiguracion[]) => exito({ parametros });

let raiz: Root;
let contenedor: HTMLDivElement;

async function montar() {
  act(() => raiz.render(<PaginaConfiguracion />));
  await esperar();
}

const campo = (clave: string) =>
  contenedor.querySelector<HTMLInputElement>(`#configuracion-${clave}`)!;
const botonDe = (clave: string) =>
  campo(clave).closest('li')!.querySelector<HTMLButtonElement>('button')!;
const dialogo = () => contenedor.querySelector<HTMLElement>('[role="alertdialog"]');
const botonDelDialogo = (texto: string) =>
  [...(dialogo()?.querySelectorAll('button') ?? [])].find((b) => b.textContent === texto)!;
const aviso = () => contenedor.querySelector('.aviso')?.textContent;

/** Escribe como el navegador: el setter nativo de value y el evento input que escucha React. */
function escribir(clave: string, texto: string) {
  const entrada = campo(clave);
  act(() => {
    Reflect.set(HTMLInputElement.prototype, 'value', texto, entrada);
    entrada.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

beforeEach(() => {
  configurarToken(() => tokenConsola('admin'));
  contenedor = document.createElement('div');
  document.body.append(contenedor);
  raiz = createRoot(contenedor);
});

afterEach(() => {
  act(() => raiz.unmount());
  contenedor.remove();
  configurarToken(() => null);
  vi.unstubAllGlobals();
});

describe('Configuración C12 con interacción real (HU-51.2)', () => {
  it('un valor inválido muestra el error junto al campo y no envía PATCH', async () => {
    const llamadas = api(lista([CUPO, UMBRAL]));
    await montar();
    escribir('umbral_eje_debil', '120');
    await pulsar(botonDe('umbral_eje_debil'));
    expect(campo('umbral_eje_debil').getAttribute('aria-invalid')).toBe('true');
    const error = document.getElementById('configuracion-umbral_eje_debil-error');
    expect(error?.textContent).toBe('El porcentaje debe estar entre 0 y 100.');
    expect(campo('umbral_eje_debil').getAttribute('aria-describedby')).toContain(error!.id);
    escribir('cupo_inicial', 'abc');
    await pulsar(botonDe('cupo_inicial'));
    expect(campo('cupo_inicial').getAttribute('aria-invalid')).toBe('true');
    expect(dialogo()).toBeNull();
    expect(llamadas.map((l) => l.metodo)).toEqual(['GET']);
  });

  it('confirma con el valor anterior y el nuevo, guarda una clave y recarga', async () => {
    const guardado = { ...CUPO, valor: 12, actualizadoEn: '2026-11-12T13:00:00.000Z' };
    const llamadas = api(
      lista([CUPO]),
      exito(guardado),
      lista([{ ...guardado, actualizadoPor: 'Ana' }]),
    );
    await montar();
    escribir('cupo_inicial', '12');
    await pulsar(botonDe('cupo_inicial'));
    expect(dialogo()?.textContent).toContain('de 10 preguntas a 12 preguntas');
    expect(document.activeElement?.textContent).toBe('Cancelar');
    await pulsar(botonDelDialogo('Guardar cambio'));
    expect(llamadas[1]).toEqual({
      metodo: 'PATCH',
      ruta: '/admin/administracion/configuracion/cupo_inicial',
      cuerpo: { valor: 12, actualizadoEn: CUPO.actualizadoEn },
    });
    expect(llamadas).toHaveLength(3);
    expect(dialogo()).toBeNull();
    expect(aviso()).toBe('Parámetro guardado y cambio registrado.');
    expect(campo('cupo_inicial').value).toBe('12');
    expect(contenedor.textContent).toContain('Ana');
  });

  it('ante CONFLICTO avisa y muestra el valor vigente que guardó otro administrador', async () => {
    const vigente = { ...CUPO, valor: 15, actualizadoEn: '2026-11-12T14:00:00.000Z' };
    const conflicto: RespuestaFalsa = {
      estado: 409,
      cuerpo: { data: null, error: { codigo: 'CONFLICTO', mensaje: 'Cambio ajeno' }, meta: null },
    };
    const llamadas = api(lista([CUPO]), conflicto, lista([vigente]));
    await montar();
    escribir('cupo_inicial', '12');
    await pulsar(botonDe('cupo_inicial'));
    await pulsar(botonDelDialogo('Guardar cambio'));
    expect(llamadas.map((l) => l.metodo)).toEqual(['GET', 'PATCH', 'GET']);
    expect(aviso()).toBe(
      'Otro administrador cambió este parámetro. Se está cargando el valor vigente.',
    );
    expect(contenedor.querySelector('[role="alert"]')).not.toBeNull();
    expect(campo('cupo_inicial').value).toBe('15');
  });

  it('Tab recorre campos y botones; el de solo lectura no tiene control', async () => {
    api(lista([CUPO, UMBRAL, MODELO]));
    await montar();
    const enfocables = [
      ...contenedor.querySelectorAll<HTMLElement>('input, button, [tabindex]'),
    ].filter((e) => !(e as HTMLButtonElement).disabled && e.tabIndex >= 0);
    expect(enfocables.map((e) => e.id || e.textContent)).toEqual([
      'configuracion-cupo_inicial',
      'Revisar cambio',
      'configuracion-umbral_eje_debil',
      'Revisar cambio',
    ]);
    for (const elemento of enfocables) {
      act(() => elemento.focus());
      expect(document.activeElement).toBe(elemento);
    }
    expect(contenedor.textContent).toContain('Solo lectura');
    expect(contenedor.querySelector('#configuracion-modelo_ia')).toBeNull();
  });

  it('dentro de la confirmación Tab no sale; Escape la cierra y devuelve el foco', async () => {
    const llamadas = api(lista([CUPO]));
    await montar();
    escribir('cupo_inicial', '12');
    const revisar = botonDe('cupo_inicial');
    await pulsar(revisar);
    expect(document.activeElement?.textContent).toBe('Cancelar');
    await tecla('Tab', true);
    expect(document.activeElement?.textContent).toBe('Guardar cambio');
    await tecla('Tab');
    expect(document.activeElement?.textContent).toBe('Cancelar');
    await tecla('Escape');
    expect(dialogo()).toBeNull();
    // El foco vuelve en el siguiente cuadro de animación (requestAnimationFrame), no al instante.
    await vi.waitFor(() => expect(document.activeElement).toBe(revisar));
    expect(llamadas).toHaveLength(1);
  });
});
