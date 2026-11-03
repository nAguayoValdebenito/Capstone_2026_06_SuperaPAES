// Textos legales vigentes (HU-34.4): la ruta pública de la API y el documento de cada página.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { configurarToken } from '../api/cliente';
import { primeraLlamada, responderUnaVez } from '../pruebas/sesion';
import { documentoDe, obtenerDocumentosVigentes } from './documentos-legales';

afterEach(() => {
  vi.unstubAllGlobals();
  configurarToken(() => null);
});

describe('textos legales vigentes', () => {
  it('los pide a la ruta pública de la API, sin el token de la consola aunque haya sesión', async () => {
    configurarToken(() => 'token-de-la-consola');
    const fetchFalso = responderUnaVez({ data: [], error: null, meta: null });

    await obtenerDocumentosVigentes();

    expect(primeraLlamada().url).toBe('/app/cuentas/documentos-legales/vigentes');
    const [, init] = fetchFalso.mock.calls[0] as unknown as [string, RequestInit];
    expect(new Headers(init.headers).has('Authorization')).toBe(false);
  });

  it('elige el documento de la página; si no está publicado, null', () => {
    const terminos = { tipo: 'terminos' as const, texto: '# Términos' };
    const privacidad = { tipo: 'privacidad' as const, texto: '# Privacidad' };

    expect(documentoDe([privacidad, terminos], 'terminos')).toBe(terminos);
    expect(documentoDe([terminos], 'privacidad')).toBeNull();
  });
});
