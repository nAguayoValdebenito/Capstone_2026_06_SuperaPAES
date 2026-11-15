// Encabezados de seguridad que Vercel agrega a la consola publicada (vercel.json) y que index.html no
// pida nada a otro origen que la política de seguridad de contenido no permita.
import { describe, expect, it } from 'vitest';
import indice from '../index.html?raw';
import configuracionVercel from '../vercel.json?raw';

interface Encabezado {
  key: string;
  value: string;
}

const { headers } = JSON.parse(configuracionVercel) as {
  headers: { source: string; headers: Encabezado[] }[];
};
const encabezados = new Map(
  headers
    .filter((g) => g.source === '/(.*)')
    .flatMap((g) => g.headers.map((e) => [e.key, e.value])),
);

function directivas(politica: string): Map<string, string[]> {
  return new Map(
    politica
      .split(';')
      .map((d) => d.trim().split(/\s+/))
      .filter((partes) => partes[0])
      .map(([nombre = '', ...valores]) => [nombre, valores]),
  );
}

describe('encabezados de seguridad de la consola publicada', () => {
  const csp = directivas(encabezados.get('Content-Security-Policy') ?? '');

  it('la política solo permite scripts propios y llamadas a la API publicada', () => {
    expect(csp.get('default-src')).toEqual(["'self'"]);
    expect(csp.get('script-src')).toEqual(["'self'"]);
    expect(csp.get('connect-src')).toEqual(["'self'", 'https://supera-paes-api.onrender.com']);
    expect(csp.get('font-src')).not.toContain('https://fonts.gstatic.com');
  });

  it('nadie puede enmarcar la consola, cambiar su base, enviar formularios afuera ni cargar plugins', () => {
    expect(csp.get('frame-ancestors')).toEqual(["'none'"]);
    expect(csp.get('base-uri')).toEqual(["'self'"]);
    expect(csp.get('form-action')).toEqual(["'self'"]);
    expect(csp.get('object-src')).toEqual(["'none'"]);
  });

  it('niega cámara, micrófono y ubicación, y exige HTTPS por dos años', () => {
    const permisos = encabezados.get('Permissions-Policy') ?? '';
    for (const permiso of ['camera=()', 'microphone=()', 'geolocation=()']) {
      expect(permisos).toContain(permiso);
    }
    expect(encabezados.get('Strict-Transport-Security')).toBe(
      'max-age=63072000; includeSubDomains',
    );
  });

  it('index.html no carga hojas, fuentes ni scripts de otro origen', () => {
    expect(indice).not.toMatch(/(?:href|src)="https?:\/\//);
  });
});
