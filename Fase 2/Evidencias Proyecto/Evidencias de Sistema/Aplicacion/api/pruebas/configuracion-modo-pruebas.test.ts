// MODO_PRUEBAS_SUSCRIPCION: apagado por defecto; solo «true» permite la suscripción simulada.
import { describe, expect, it } from 'vitest';
import { leerConfiguracion } from '../comun/configuracion.js';
import { variablesMinimas as minimas } from './variables-configuracion.js';

describe('modo de pruebas de suscripción', () => {
  const modo = (valor?: string) =>
    leerConfiguracion({ ...minimas, MODO_PRUEBAS_SUSCRIPCION: valor }).modoPruebasSuscripcion;

  it('está apagado sin la variable, vacía o en false', () => {
    expect(modo()).toBe(false);
    expect(modo('')).toBe(false);
    expect(modo('false')).toBe(false);
  });

  it('se enciende con true y rechaza otros valores', () => {
    expect(modo('true')).toBe(true);
    expect(() => modo('si')).toThrow(/MODO_PRUEBAS_SUSCRIPCION/);
  });
});

// MODO_PRUEBAS_PREGUNTAS: apagado por defecto; solo «true» permite publicar sin revisión.
describe('modo de pruebas de preguntas', () => {
  const modo = (valor?: string) =>
    leerConfiguracion({ ...minimas, MODO_PRUEBAS_PREGUNTAS: valor }).modoPruebasPreguntas;

  it('está apagado sin la variable, vacía o en false', () => {
    expect([modo(), modo(''), modo('false')]).toEqual([false, false, false]);
  });

  it('se enciende con true y rechaza otros valores', () => {
    expect(modo('true')).toBe(true);
    expect(() => modo('si')).toThrow(/MODO_PRUEBAS_PREGUNTAS/);
  });
});
