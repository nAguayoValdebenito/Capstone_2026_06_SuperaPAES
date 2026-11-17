// Reintento del inicio de la práctica (RN-19): solo ante el rechazo del cierre por cerrada_en anterior a
// iniciada_en, reconocido por código y restricción, y a lo más dos veces después del primer intento.
import { describe, expect, it, vi } from 'vitest';
import {
  conReintentoDeInicio,
  REINTENTOS_INICIO,
} from '../modulos/evaluaciones/evaluaciones.reintento-inicio.js';

const cierreAntesDelInicio = () =>
  Object.assign(new Error('new row for relation "evaluacion" violates check constraint'), {
    code: '23514',
    constraint: 'evaluacion_check2',
  });

describe('reintento del inicio de la práctica', () => {
  it('repite la transacción ante ese rechazo y devuelve el resultado del intento que pasa', async () => {
    const transaccion = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(cierreAntesDelInicio())
      .mockRejectedValueOnce(cierreAntesDelInicio())
      .mockResolvedValueOnce('creada');

    await expect(conReintentoDeInicio(transaccion)).resolves.toBe('creada');
    expect(transaccion).toHaveBeenCalledTimes(3);
  });

  it('se rinde después de dos reintentos y deja salir el error', async () => {
    const error = cierreAntesDelInicio();
    const transaccion = vi.fn<() => Promise<string>>().mockRejectedValue(error);

    await expect(conReintentoDeInicio(transaccion)).rejects.toBe(error);
    expect(REINTENTOS_INICIO).toBe(2);
    expect(transaccion).toHaveBeenCalledTimes(1 + REINTENTOS_INICIO);
  });

  it.each([
    ['otra restricción con el mismo código', { code: '23514', constraint: 'evaluacion_check1' }],
    ['la misma restricción con otro código', { code: '23505', constraint: 'evaluacion_check2' }],
    ['un error que solo la nombra en el texto', { message: 'evaluacion_check2 cerrada_en' }],
    ['un error de la aplicación', { code: 'SIN_PREGUNTAS_SUFICIENTES' }],
  ])('no reintenta %s', async (_caso, datos) => {
    const error = Object.assign(new Error('falla'), datos);
    const transaccion = vi.fn<() => Promise<string>>().mockRejectedValue(error);

    await expect(conReintentoDeInicio(transaccion)).rejects.toBe(error);
    expect(transaccion).toHaveBeenCalledOnce();
  });
});
