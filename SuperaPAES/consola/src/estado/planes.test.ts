import { afterEach, describe, expect, it, vi } from 'vitest';
import { configurarToken } from '../api/cliente';
import { datosPlanes, planDePrueba } from '../pruebas/planes';
import { primeraLlamada, responderUnaVez } from '../pruebas/sesion';
import { editarPlan, listarPlanes } from '../servicios/planes';
import { camposDelPlan } from './formulario-plan';

afterEach(() => {
  configurarToken(() => null);
  vi.unstubAllGlobals();
});

describe('edición de planes en la consola (HU-52.2)', () => {
  it('carga el catálogo admin y permite cancelar la solicitud', async () => {
    responderUnaVez({ data: datosPlanes, error: null, meta: null });
    const control = new AbortController();
    expect(await listarPlanes(control.signal)).toEqual(datosPlanes);
    expect(primeraLlamada().url).toBe('/admin/suscripciones/planes');
    expect(vi.mocked(fetch).mock.calls[0]?.[1]?.signal).toBe(control.signal);
  });

  it('envía la edición al id existente con los ids de las opciones, los productos y el estado', async () => {
    configurarToken(() => 'sesion-de-prueba');
    responderUnaVez({ data: planDePrueba, error: null, meta: null });
    const datos = { ...camposDelPlan(planDePrueba), precioClp: 2400, activo: false };
    expect(await editarPlan(planDePrueba.id, datos)).toEqual(planDePrueba);
    expect(primeraLlamada()).toEqual({
      url: '/admin/suscripciones/planes/19',
      metodo: 'PUT',
      cuerpo: JSON.stringify(datos),
    });
    const encabezados = new Headers(vi.mocked(fetch).mock.calls[0]?.[1]?.headers);
    expect(encabezados.get('Authorization')).toBe('Bearer sesion-de-prueba');
    expect(datos).toMatchObject({ alcanceId: 23, periodicidadId: 31 });
  });

  it('conserva el mensaje del servidor si la edición se rechaza', async () => {
    responderUnaVez(
      {
        data: null,
        error: { codigo: 'CONFLICTO', mensaje: 'El producto ya está en uso.' },
        meta: null,
      },
      409,
    );
    await expect(editarPlan(planDePrueba.id, camposDelPlan(planDePrueba))).rejects.toThrow(
      'El producto ya está en uso.',
    );
  });

  it('prepara el formulario sin mutar los productos guardados al escribir', () => {
    const campos = camposDelPlan(planDePrueba);
    campos.productos.google_play = 'otro_producto';
    expect(planDePrueba.productos.google_play).toBe('una_prueba_mensual');
  });
});
