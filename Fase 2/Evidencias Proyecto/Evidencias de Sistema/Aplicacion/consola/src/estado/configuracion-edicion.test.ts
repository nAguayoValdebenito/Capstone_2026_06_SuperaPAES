import { describe, expect, it } from 'vitest';
import type { ParametroConfiguracion } from '../tipos/configuracion';
import { prepararCambioConfiguracion } from './configuracion-edicion';

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

describe('preparación de cambios C12', () => {
  it('impide abrir la confirmación con un valor inválido o sin cambios', () => {
    expect(prepararCambioConfiguracion(parametro, '1.5')).toEqual({
      tipo: 'invalido',
      mensaje: 'Escribe un número entero.',
    });
    expect(prepararCambioConfiguracion(parametro, '10')).toEqual({
      tipo: 'invalido',
      mensaje: 'No hay cambios por guardar.',
    });
  });

  it('conserva el parámetro y el nuevo valor para la confirmación', () => {
    expect(prepararCambioConfiguracion(parametro, '12')).toEqual({
      tipo: 'listo',
      confirmacion: { parametro, valor: 12 },
    });
  });
});
