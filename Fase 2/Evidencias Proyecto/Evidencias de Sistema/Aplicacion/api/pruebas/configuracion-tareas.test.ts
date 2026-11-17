import { describe, expect, it } from 'vitest';
import { leerConfiguracion } from '../comun/configuracion.js';
import { variablesMinimas as minimas } from './variables-configuracion.js';

describe('CLAVE_TAREAS (tareas periódicas, DAS 4.3.3)', () => {
  it('es opcional: sin ella, o vacía, la ruta no se monta', () => {
    expect(leerConfiguracion(minimas).claveTareas).toBeUndefined();
    expect(leerConfiguracion({ ...minimas, CLAVE_TAREAS: '' }).claveTareas).toBeUndefined();
  });

  it('con ella, la entrega', () => {
    const clave = 'clave-de-tareas-de-prueba-con-32-caracteres';
    expect(leerConfiguracion({ ...minimas, CLAVE_TAREAS: clave }).claveTareas).toBe(clave);
  });

  it('rechaza una clave corta o repetida con otro secreto', () => {
    expect(() => leerConfiguracion({ ...minimas, CLAVE_TAREAS: 'corta' })).toThrow(/CLAVE_TAREAS/);
    expect(() =>
      leerConfiguracion({ ...minimas, CLAVE_TAREAS: minimas.JWT_SECRETO_CONSOLA }),
    ).toThrow(/CLAVE_TAREAS[\s\S]*distinta/);
  });
});
