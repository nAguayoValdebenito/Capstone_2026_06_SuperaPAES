import { describe, expect, it } from 'vitest';
import { seccionesQueCoinciden } from './busqueda-global';

describe('búsqueda de secciones (Ctrl K)', () => {
  it('sin texto ofrece todas las secciones del rol, en el orden del menú', () => {
    const titulos = seccionesQueCoinciden('docente', '').map((r) => r.titulo);
    expect(titulos).toEqual(['Mis revisiones', 'Desempates', 'Mi saldo', 'Calibración']);
  });

  it('encuentra sin distinguir tildes y no muestra secciones de otro rol', () => {
    expect(seccionesQueCoinciden('admin', 'configuracion').map((r) => r.ruta)).toEqual([
      '/configuracion',
    ]);
    expect(seccionesQueCoinciden('docente', 'banco')).toEqual([]);
  });

  it('también busca por el grupo del menú', () => {
    const rutas = seccionesQueCoinciden('admin', 'atencion').map((r) => r.ruta);
    expect(rutas).toEqual(['/avisos-error', '/solicitudes-datos']);
  });
});
