// El color del sello de cada prueba PAES (.sello__marca en global.css) según su código: CL, M1, M2, HCS
// o CIE (también CIE-Bio, CIE-Fís, CIE-Quí). Un código desconocido queda en gris, sin inventar un tono.
import type { CSSProperties } from 'react';

const TONOS: Readonly<Record<string, string>> = {
  CL: 'var(--cl)',
  M1: 'var(--m1)',
  M2: 'var(--m2)',
  HCS: 'var(--hcs)',
  CIE: 'var(--cie)',
};

/** El tono de la prueba para la variable --color-prueba del sello. */
export function tonoDePrueba(codigo: string): string {
  const base = codigo.split('-')[0]?.toUpperCase() ?? '';
  return TONOS[base] ?? 'var(--tinta-3)';
}

/** El estilo en línea que pinta .sello__marca con el tono de la prueba. */
export function estiloDeSello(codigo: string): CSSProperties {
  return { '--color-prueba': tonoDePrueba(codigo) } as CSSProperties;
}
