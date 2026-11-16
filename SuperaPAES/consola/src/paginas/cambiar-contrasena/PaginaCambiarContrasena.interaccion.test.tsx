// @vitest-environment jsdom
// Cambia tu contraseña con interacción real: la consola completa (sesión, rutas, cliente HTTP) en jsdom;
// solo se reemplaza fetch, que responde como la API. Comprueba la redirección cuando la sesión trae la
// marca o una petición responde 403 CAMBIO_CONTRASENA_PENDIENTE, y la vuelta al inicio al guardar.
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../App';
import { abrirSesion, cambioPendienteGuardado } from '../../estado/almacen-sesion';
import { escribirEn, esperar } from '../../pruebas/interaccion';
import { sesionDePrueba } from '../../pruebas/sesion';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let raiz: Root;
let contenedor: HTMLDivElement;

/** Muestra la ruta actual para comprobar las redirecciones. */
function Ubicacion() {
  return <output data-ruta={useLocation().pathname} />;
}

const rutaActual = () => contenedor.querySelector('output')?.getAttribute('data-ruta');
const titulo = () => contenedor.querySelector('h1')?.textContent;

async function montar(ruta: string) {
  act(() =>
    raiz.render(
      <MemoryRouter initialEntries={[ruta]}>
        <App sesionInicial={null} />
        <Ubicacion />
      </MemoryRouter>,
    ),
  );
  await esperar();
}

/**
 * fetch falso: el cambio de contraseña responde bien; cualquier otra petición, con `otras` (por
 * defecto, 403 CAMBIO_CONTRASENA_PENDIENTE, como la API mientras falta el cambio).
 */
function apiFalsa(otras = { codigo: 'CAMBIO_CONTRASENA_PENDIENTE', estado: 403 }) {
  const llamadas: { metodo: string; ruta: string; cuerpo: unknown }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init?: RequestInit) => {
      const ruta = url.replace(/^.*\/api\/v1/, '');
      const cuerpo =
        typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : undefined;
      llamadas.push({ metodo: init?.method ?? 'GET', ruta, cuerpo });
      const respuesta =
        ruta === '/admin/cuentas/contrasena'
          ? { data: { contrasenaCambiada: true }, error: null, meta: null }
          : { data: null, error: { codigo: otras.codigo, mensaje: 'No disponible.' }, meta: null };
      const estado = ruta === '/admin/cuentas/contrasena' ? 200 : otras.estado;
      return Promise.resolve(new Response(JSON.stringify(respuesta), { status: estado }));
    }),
  );
  return llamadas;
}

beforeEach(() => {
  sessionStorage.clear();
  contenedor = document.createElement('div');
  document.body.append(contenedor);
  raiz = createRoot(contenedor);
});

afterEach(() => {
  act(() => raiz.unmount());
  contenedor.remove();
  sessionStorage.clear();
  vi.unstubAllGlobals();
});

describe('Cambia tu contraseña en la consola', () => {
  it('si la sesión trae debeCambiarContrasena, cualquier sección lleva a Cambia tu contraseña', async () => {
    apiFalsa();
    abrirSesion({ ...sesionDePrueba('admin'), usuario: { debeCambiarContrasena: true } });

    await montar('/usuarios-internos');

    expect(rutaActual()).toBe('/cambiar-contrasena');
    expect(titulo()).toBe('Cambia tu contraseña');
  });

  it('si una petición responde CAMBIO_CONTRASENA_PENDIENTE, lleva a Cambia tu contraseña', async () => {
    apiFalsa();
    abrirSesion(sesionDePrueba('admin'));
    expect(cambioPendienteGuardado()).toBe(false);

    await montar('/usuarios-internos');

    expect(rutaActual()).toBe('/cambiar-contrasena');
    expect(cambioPendienteGuardado()).toBe(true);
  });

  it('al guardar envía la actual y la nueva, quita la marca y vuelve al inicio del rol', async () => {
    const llamadas = apiFalsa({ codigo: 'ERROR_INTERNO', estado: 500 });
    abrirSesion({ ...sesionDePrueba('admin'), usuario: { debeCambiarContrasena: true } });
    await montar('/cambiar-contrasena');

    const campo = (nombre: string) =>
      contenedor.querySelector<HTMLInputElement>(`input[name="${nombre}"]`)!;
    escribirEn(campo('actual'), 'clave-asignada-1');
    escribirEn(campo('nueva'), 'mi clave propia');
    escribirEn(campo('repeticion'), 'mi clave propia');
    act(() => {
      contenedor.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
    });
    await esperar();

    expect(llamadas[0]).toEqual({
      metodo: 'POST',
      ruta: '/admin/cuentas/contrasena',
      cuerpo: { actual: 'clave-asignada-1', nueva: 'mi clave propia' },
    });
    expect(cambioPendienteGuardado()).toBe(false);
    expect(rutaActual()).toBe('/banco');
  });

  it('un error local no envía nada y queda bajo el campo', async () => {
    const llamadas = apiFalsa();
    abrirSesion({ ...sesionDePrueba('docente'), usuario: { debeCambiarContrasena: true } });
    await montar('/cambiar-contrasena');
    const campo = (nombre: string) =>
      contenedor.querySelector<HTMLInputElement>(`input[name="${nombre}"]`)!;
    escribirEn(campo('actual'), 'clave-asignada-1');
    escribirEn(campo('nueva'), 'mi clave propia');
    escribirEn(campo('repeticion'), 'otra clave larga');

    act(() => {
      contenedor.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
    });
    await esperar();

    expect(llamadas).toHaveLength(0);
    expect(contenedor.querySelector('.restablecer__error')?.textContent).toBe(
      'Las dos contraseñas no coinciden.',
    );
    expect(rutaActual()).toBe('/cambiar-contrasena');
  });
});
