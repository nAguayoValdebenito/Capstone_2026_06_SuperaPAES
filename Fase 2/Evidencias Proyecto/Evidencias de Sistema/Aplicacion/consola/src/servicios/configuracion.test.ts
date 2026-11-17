import { beforeEach, describe, expect, it, vi } from 'vitest';
import { solicitarAdmin } from '../api/cliente';
import type { ParametroConfiguracion } from '../tipos/configuracion';
import { cambiarConfiguracion, listarConfiguracion } from './configuracion';

vi.mock('../api/cliente', () => ({ solicitarAdmin: vi.fn() }));

const parametro: ParametroConfiguracion = {
  clave: 'cupo_inicial',
  nombre: 'Cupo inicial',
  descripcion: 'Cupo diario',
  valor: 10,
  unidad: 'preguntas',
  editable: true,
  regla: 'RN-01',
  actualizadoEn: '2026-11-12T12:00:00.000Z',
  actualizadoPor: 'Admin',
};

beforeEach(() => vi.mocked(solicitarAdmin).mockReset());

describe('servicio de configuración C12', () => {
  it('consulta la lista de la API con cancelación', async () => {
    const senal = new AbortController().signal;
    vi.mocked(solicitarAdmin).mockResolvedValue({ data: { parametros: [parametro] }, meta: null });
    await expect(listarConfiguracion(senal)).resolves.toEqual({ parametros: [parametro] });
    expect(solicitarAdmin).toHaveBeenCalledWith('/administracion/configuracion', { signal: senal });
  });

  it('envía el valor y la versión recibida para evitar pisar otro cambio', async () => {
    vi.mocked(solicitarAdmin).mockResolvedValue({ data: { ...parametro, valor: 12 }, meta: null });
    await cambiarConfiguracion(parametro, 12);
    expect(solicitarAdmin).toHaveBeenCalledWith('/administracion/configuracion/cupo_inicial', {
      method: 'PATCH',
      body: JSON.stringify({ valor: 12, actualizadoEn: parametro.actualizadoEn }),
    });
  });
});
