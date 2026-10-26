// Contrato interno del cierre: una transacción, bloqueo previo y una sola llamada a la función de la
// base. El servicio no recibe dependencias de cuentas, cupo ni suscripciones (HU-33/CU-07b).
import { describe, expect, it, vi } from 'vitest';
import type { Ejecutor, UnidadDeTrabajo } from '../db/transaccion.js';
import { crearResumenServicio } from '../modulos/evaluaciones/evaluaciones.resumen.servicio.js';

const resumen = {
  id: '7',
  prueba: { id: 1, codigo: 'M1', nombre: 'Matemática 1' },
  alcance: { tipo: 'prueba' as const, id: 1, nombre: 'Matemática 1' },
  dificultad: { id: null, codigo: 'mezcla', nombre: 'Mezcla' },
  cantidad: 5,
  respondidas: 0,
  correctas: 0,
  incorrectas: 0,
  omitidas: 0,
  porcentaje: 0,
  tiempoUsadoSeg: 0,
  ejes: [],
  habilidades: [],
};

describe('servicio de cierre y resumen', () => {
  it('bloquea, cierra exactamente una vez y lee el resultado dentro de la misma transacción', async () => {
    const tx = { query: vi.fn() } as unknown as Ejecutor;
    const transacciones = vi.fn();
    const enTransaccion: UnidadDeTrabajo['enTransaccion'] = async <T>(
      trabajo: (ejecutor: Ejecutor) => Promise<T>,
    ) => {
      transacciones();
      return await trabajo(tx);
    };
    const unidadDeTrabajo: UnidadDeTrabajo = { enTransaccion };
    const bloquearPractica = vi.fn(() => Promise.resolve({ cerradaEn: null }));
    const cerrarEntregada = vi.fn(() => Promise.resolve());
    const leerResumen = vi.fn(() => Promise.resolve(resumen));
    const repositorio = {
      bloquearPractica,
      cerrarEntregada,
      leerResumen,
    };
    const servicio = crearResumenServicio({ repositorio, unidadDeTrabajo });

    await expect(servicio.cerrarPractica('3', '7')).resolves.toEqual(resumen);

    expect(bloquearPractica).toHaveBeenCalledWith('7', '3', tx);
    expect(cerrarEntregada).toHaveBeenCalledTimes(1);
    expect(cerrarEntregada).toHaveBeenCalledWith('7', tx);
    expect(leerResumen).toHaveBeenCalledWith('7', '3', tx);
    expect(transacciones).toHaveBeenCalledTimes(1);
  });
});
