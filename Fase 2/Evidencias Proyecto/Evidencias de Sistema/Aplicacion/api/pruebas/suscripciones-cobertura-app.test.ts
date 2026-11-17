import { describe, expect, it, vi } from 'vitest';
import { crearSuscripcionesRepositorio } from '../modulos/suscripciones/suscripciones.repositorio.js';

describe('cobertura de la suscripción para F3', () => {
  it('consulta con el reloj del servicio y conserva los datos de cobertura', async () => {
    const ahora = new Date('2027-02-01T12:00:00Z');
    const fila = { alcance: 'una_prueba', pruebasIncluidas: [2], coberturaVigente: true };
    const query = vi.fn().mockResolvedValue({ rows: [fila] });
    const repositorio = crearSuscripcionesRepositorio({ query });
    expect(await repositorio.vigenteDe('estudiante', ahora)).toEqual(fila);
    expect(query).toHaveBeenCalledExactlyOnceWith(expect.any(String), ['estudiante', ahora]);
  });

  it('sin suscripción no inventa cobertura', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const repositorio = crearSuscripcionesRepositorio({ query });
    expect(await repositorio.vigenteDe('estudiante', new Date('2027-02-01'))).toBeNull();
  });
});
