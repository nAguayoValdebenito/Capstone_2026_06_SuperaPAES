import type { Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { manejarErrores } from '../comun/middleware/manejo-errores.js';

describe('manejarErrores', () => {
  it('si la respuesta ya empezó, deja el error a Express sin escribir otra respuesta', () => {
    const error = new Error('tarde');
    const next = vi.fn();
    const json = vi.fn();
    const res = { headersSent: true, status: vi.fn(), json } as unknown as Response;

    manejarErrores(error, {} as Request, res, next);

    expect(next).toHaveBeenCalledWith(error);
    expect(json).not.toHaveBeenCalled();
  });
});
