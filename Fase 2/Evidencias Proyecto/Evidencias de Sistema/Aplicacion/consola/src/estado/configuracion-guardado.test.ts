import { describe, expect, it, vi } from 'vitest';
import { ErrorApi } from '../api/cliente';
import type { ParametroConfiguracion } from '../tipos/configuracion';
import { ejecutarGuardadoConfiguracion } from './configuracion-guardado';

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

function acciones(
  cambiar: (parametro: ParametroConfiguracion, valor: number) => Promise<ParametroConfiguracion>,
) {
  return {
    cambiar,
    limpiarBorrador: vi.fn(),
    marcarError: vi.fn(),
    avisar: vi.fn(),
    recargar: vi.fn(),
  };
}

describe('guardado de configuración C12', () => {
  it('guarda una sola clave, limpia el borrador y recarga los valores', async () => {
    const d = acciones(vi.fn(() => Promise.resolve({ ...parametro, valor: 12 })));
    await ejecutarGuardadoConfiguracion({ parametro, valor: 12 }, d);
    expect(d.cambiar).toHaveBeenCalledExactlyOnceWith(parametro, 12);
    expect(d.limpiarBorrador).toHaveBeenCalledWith('cupo_inicial');
    expect(d.recargar).toHaveBeenCalledOnce();
    expect(d.avisar).toHaveBeenCalledWith(expect.objectContaining({ tipo: 'exito' }));
  });

  it('ante CONFLICTO descarta el borrador viejo y recarga el valor vigente', async () => {
    const d = acciones(vi.fn(() => Promise.reject(new ErrorApi(409, 'CONFLICTO', 'Cambio ajeno'))));
    await ejecutarGuardadoConfiguracion({ parametro, valor: 12 }, d);
    expect(d.limpiarBorrador).toHaveBeenCalledWith('cupo_inicial');
    expect(d.recargar).toHaveBeenCalledOnce();
    expect(d.avisar).toHaveBeenCalledWith(expect.objectContaining({ tipo: 'error' }));
  });

  it('muestra la validación de la API junto al campo sin recargar', async () => {
    const d = acciones(
      vi.fn(() => Promise.reject(new ErrorApi(400, 'VALIDACION', 'Fuera de rango'))),
    );
    await ejecutarGuardadoConfiguracion({ parametro, valor: 12 }, d);
    expect(d.marcarError).toHaveBeenCalledWith('cupo_inicial', 'Fuera de rango');
    expect(d.recargar).not.toHaveBeenCalled();
  });
});
