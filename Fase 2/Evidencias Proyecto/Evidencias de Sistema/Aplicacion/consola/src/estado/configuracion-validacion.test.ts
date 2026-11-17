import { describe, expect, it } from 'vitest';
import { validarEntradaConfiguracion } from './configuracion-validacion';

describe('validación previa de configuración C12', () => {
  it('acepta enteros positivos, el porcentaje de 0 a 100 y dólares con dos decimales', () => {
    expect(validarEntradaConfiguracion('cupo_inicial', '12')).toEqual({ valor: 12 });
    expect(validarEntradaConfiguracion('umbral_eje_debil', '0')).toEqual({ valor: 0 });
    expect(validarEntradaConfiguracion('umbral_eje_debil', '100')).toEqual({ valor: 100 });
    expect(validarEntradaConfiguracion('tope_mensual_ia_usd', '10.25')).toEqual({ valor: 10.25 });
    expect(validarEntradaConfiguracion('tope_mensual_ia_usd', '10,25')).toEqual({ valor: 10.25 });
  });

  it('rechaza vacío, fracciones en enteros, límites y más de dos decimales', () => {
    expect(validarEntradaConfiguracion('umbral_eje_debil', ' ').error).toBeTruthy();
    expect(validarEntradaConfiguracion('cupo_inicial', '1.5').error).toContain('entero');
    expect(validarEntradaConfiguracion('cupo_inicial', '0').error).toContain('cero');
    expect(validarEntradaConfiguracion('umbral_eje_debil', '101').error).toContain('100');
    expect(validarEntradaConfiguracion('tope_mensual_ia_usd', '1.234').error).toContain(
      'decimales',
    );
  });
});
