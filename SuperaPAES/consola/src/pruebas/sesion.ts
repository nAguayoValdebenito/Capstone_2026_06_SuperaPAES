// Ayudantes de las pruebas de sesión: tokens con la forma de los que emite la API (sin firma real) y
// un sessionStorage en memoria, porque las pruebas de la consola corren en Node.
import { vi } from 'vitest';
import type { SesionIniciada } from '../tipos';

function base64Url(texto: string): string {
  const binario = String.fromCharCode(...new TextEncoder().encode(texto));
  return btoa(binario).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export const UNA_HORA = 3600;

/** Token con la cabecera y los datos de un JWT de la API; la firma es de relleno. */
export function tokenDePrueba(datos: Record<string, unknown>): string {
  const cabecera = base64Url(JSON.stringify({ alg: 'HS256' }));
  return `${cabecera}.${base64Url(JSON.stringify(datos))}.firma`;
}

/** Token de la consola vigente durante una hora para el rol indicado. */
export function tokenConsola(rol: string, sub = 'u-1'): string {
  const exp = Math.floor(Date.now() / 1000) + UNA_HORA;
  return tokenDePrueba({ sub, rol, aud: 'admin', iss: 'supera-paes', exp });
}

export function sesionDePrueba(rol: string): SesionIniciada {
  return { tokenAcceso: tokenConsola(rol), tokenRenovacion: 'renovacion' };
}

/** Instala un sessionStorage en memoria y lo devuelve para revisar su contenido. */
export function instalarAlmacen(): Map<string, string> {
  const datos = new Map<string, string>();
  vi.stubGlobal('sessionStorage', {
    getItem: (clave: string) => datos.get(clave) ?? null,
    setItem: (clave: string, valor: string) => void datos.set(clave, valor),
    removeItem: (clave: string) => void datos.delete(clave),
  });
  return datos;
}

/** Hace que fetch responda una sola vez con ese cuerpo y estado HTTP. */
export function responderUnaVez(cuerpo: unknown, estado = 200) {
  const fetchFalso = vi.fn(() =>
    Promise.resolve(new Response(JSON.stringify(cuerpo), { status: estado })),
  );
  vi.stubGlobal('fetch', fetchFalso);
  return fetchFalso;
}
