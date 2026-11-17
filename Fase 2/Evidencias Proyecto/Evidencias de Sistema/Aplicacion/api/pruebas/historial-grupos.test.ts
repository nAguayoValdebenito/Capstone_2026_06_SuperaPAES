import { describe, expect, it, vi } from 'vitest';
import type { Ejecutor } from '../db/transaccion.js';
import { crearHistorialRepositorio } from '../modulos/evaluaciones/evaluaciones.historial.repositorio.js';
import { esquemaHistorial } from '../modulos/evaluaciones/evaluaciones.validadores.js';

describe('grupos del historial de F5', () => {
  it('acepta solo los dos grupos previstos y conserva los filtros específicos', () => {
    expect(esquemaHistorial.parse({ grupo: 'practicas', tipo: 'repaso' })).toEqual({
      grupo: 'practicas',
      tipo: 'repaso',
      pagina: 1,
      porPagina: 20,
    });
    expect(esquemaHistorial.parse({ grupo: 'evaluaciones' }).grupo).toBe('evaluaciones');
    expect(esquemaHistorial.safeParse({ grupo: 'otro' }).success).toBe(false);
  });

  it('conserva estudiante, prueba y grupo al contar una página fuera de rango', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ total: 3 }] });
    const bd: Ejecutor = { query };
    const pagina = await crearHistorialRepositorio(bd).listar({
      estudianteId: '42',
      pruebaId: 2,
      grupo: 'evaluaciones',
      pagina: 4,
      porPagina: 2,
    });
    expect(query).toHaveBeenCalledTimes(2);
    expect(query.mock.calls[0]?.[1]).toEqual(['42', 2, null, 'evaluaciones', 2, 6]);
    expect(query.mock.calls[1]?.[1]).toEqual(['42', 2, null, 'evaluaciones']);
    expect(pagina).toEqual({ filas: [], total: 3 });
  });
});
