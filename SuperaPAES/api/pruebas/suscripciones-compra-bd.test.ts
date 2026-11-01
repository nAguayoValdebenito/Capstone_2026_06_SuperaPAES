// HU-43.1 esc. 2 y 3, CU-12 pasos 4 y 5 y alternativos 1.b y 4.a, contra PostgreSQL real: la API
// valida la compra con la tienda (aquí, una pasarela falsa) y activa la suscripción en una sola
// transacción, con su historial (origen estudiante) y el pago (monto de referencia: el precio del plan).
// Repetir la misma compra no duplica nada. Google se confirma (acknowledge) después de la transacción;
// si falla, la suscripción sigue activa y se reintenta en la siguiente validación de esa compra.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { exigirBaseEnCi, urlBase } from './base-temporal.js';
import { AHORA, compraActiva, FIN_MENSUAL, prepararCompras } from './compras-de-prueba.js';

exigirBaseEnCi();
describe.skipIf(!urlBase)('validación de compras con PostgreSQL (HU-43.1)', () => {
  const c = prepararCompras('compra');
  const { base, planes, tienda } = c;

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /** Ana con una pendiente de Todas las pruebas mensual en Google Play. */
  async function anaConPendiente(plan = 'Todas las pruebas mensual', pruebaId?: number) {
    const { token } = await base.sesion('ana@ejemplo.cl');
    const suscripcion = await c.pendiente(token, plan, pruebaId === undefined ? {} : { pruebaId });
    return { token, ...suscripcion };
  }

  describe('activación', () => {
    it('activa la pendiente, registra el historial y el pago, y entrega el período', async () => {
      const { token, id, cuentaTienda } = await anaConPendiente();
      tienda.verificar.mockResolvedValue(compraActiva({ cuentaTienda }));

      const respuesta = await c.validar(token, id, { idCompraTienda: 'token-compra-1' });

      expect(respuesta.status).toBe(200);
      expect(respuesta.body.data).toEqual({
        id,
        estado: 'activa',
        planId: planes['Todas las pruebas mensual'],
        tienda: 'google_play',
        pruebaId: null,
        idProducto: 'todas_mensual',
        cuentaTienda,
        periodoFin: FIN_MENSUAL.toISOString(),
        cambioEnRenovacion: null,
      });
      expect(tienda.verificar).toHaveBeenCalledWith('token-compra-1');
      expect(await c.guardada(id)).toMatchObject({
        estado: 'activa',
        vigente: true,
        idCompraTienda: 'token-compra-1',
        inicio: AHORA,
        periodoFin: FIN_MENSUAL,
      });
      expect(await c.historial(id)).toEqual([
        expect.objectContaining({ estadoAnterior: null, estadoNuevo: 'pendiente' }),
        {
          estadoAnterior: 'pendiente',
          estadoNuevo: 'activa',
          planAnterior: planes['Todas las pruebas mensual'],
          planNuevo: planes['Todas las pruebas mensual'],
          origen: 'estudiante',
          creadoEn: AHORA,
        },
      ]);
      expect(await c.pagos(id)).toEqual([
        {
          idPagoPasarela: 'GPA.0001',
          montoClp: 2990,
          estado: 'aprobado',
          periodoInicio: '2026-11-15',
          periodoFin: '2026-12-15',
        },
      ]);
    });

    it('acepta la cuenta de la App Store escrita en mayúsculas (UUID de StoreKit)', async () => {
      const { token, id, cuentaTienda } = await anaConPendiente();
      tienda.verificar.mockResolvedValue(
        compraActiva({ tienda: 'app_store', cuentaTienda: cuentaTienda.toUpperCase() }),
      );

      expect((await c.validar(token, id, { idCompraTienda: '2000000123' })).status).toBe(200);
    });

    it('repetir la misma compra devuelve el estado actual sin duplicar historial ni pago', async () => {
      const { token, id, cuentaTienda } = await anaConPendiente();
      tienda.verificar.mockResolvedValue(compraActiva({ cuentaTienda }));
      const primera = await c.validar(token, id, { idCompraTienda: 'token-compra-1' });

      const segunda = await c.validar(token, id, { idCompraTienda: 'token-compra-1' });

      expect(segunda.status).toBe(200);
      expect(segunda.body).toEqual(primera.body);
      expect(await c.historial(id)).toHaveLength(2);
      expect(await c.pagos(id)).toHaveLength(1);
    });

    it('Una prueba conserva la prueba elegida al activarse', async () => {
      const { token, id, cuentaTienda } = await anaConPendiente(
        'Una prueba mensual',
        base.pruebaId,
      );
      tienda.verificar.mockResolvedValue(
        compraActiva({ cuentaTienda, idProducto: 'una_prueba_mensual' }),
      );

      const respuesta = await c.validar(token, id, { idCompraTienda: 'token-compra-1' });

      expect(respuesta.body.data).toMatchObject({ estado: 'activa', pruebaId: base.pruebaId });
      expect((await c.pagos(id))[0]).toMatchObject({ montoClp: 1990 });
    });
  });

  describe('confirmación en Google Play (acknowledge)', () => {
    it('confirma la compra una vez, después de activarla', async () => {
      const { token, id, cuentaTienda } = await anaConPendiente();
      tienda.verificar.mockResolvedValue(compraActiva({ cuentaTienda, porConfirmar: true }));

      await c.validar(token, id, { idCompraTienda: 'token-compra-1' });

      expect(tienda.confirmar).toHaveBeenCalledTimes(1);
      expect(tienda.confirmar).toHaveBeenCalledWith({
        idProducto: 'todas_mensual',
        idCompraTienda: 'token-compra-1',
      });
    });

    it('si la confirmación falla, sigue activa, lo registra sin la compra y reintenta después', async () => {
      const registro = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const { token, id, cuentaTienda } = await anaConPendiente();
      tienda.verificar.mockResolvedValue(compraActiva({ cuentaTienda, porConfirmar: true }));
      tienda.confirmar.mockRejectedValueOnce(new Error('Google no responde'));

      const primera = await c.validar(token, id, { idCompraTienda: 'token-compra-1' });
      const segunda = await c.validar(token, id, { idCompraTienda: 'token-compra-1' });

      expect(primera.status).toBe(200);
      expect(primera.body.data.estado).toBe('activa');
      expect(JSON.stringify(registro.mock.calls)).toContain('confirmar');
      expect(JSON.stringify(registro.mock.calls)).not.toContain('token-compra-1');
      expect(segunda.status).toBe(200);
      expect(tienda.confirmar).toHaveBeenCalledTimes(2);
      expect(await c.historial(id)).toHaveLength(2);
    });

    it('no confirma una compra ya confirmada', async () => {
      const { token, id, cuentaTienda } = await anaConPendiente();
      tienda.verificar.mockResolvedValue(compraActiva({ cuentaTienda }));

      await c.validar(token, id, { idCompraTienda: 'token-compra-1' });

      expect(tienda.confirmar).not.toHaveBeenCalled();
    });
  });

  describe('pago en espera y primer pago fallido (CU-12 4.a)', () => {
    const espera = (cuentaTienda: string) =>
      compraActiva({ cuentaTienda, estado: 'pendiente', periodoFin: null, idPagoPasarela: null });

    it('PENDING deja la suscripción pendiente con la compra ligada, sin pago ni historial', async () => {
      const { token, id, cuentaTienda } = await anaConPendiente();
      tienda.verificar.mockResolvedValue(espera(cuentaTienda));

      const respuesta = await c.validar(token, id, { idCompraTienda: 'token-compra-1' });

      expect(respuesta.status).toBe(200);
      expect(respuesta.body.data.estado).toBe('pendiente');
      expect(await c.guardada(id)).toMatchObject({ idCompraTienda: 'token-compra-1' });
      expect(await c.historial(id)).toHaveLength(1);
      expect(await c.pagos(id)).toEqual([]);
    });

    it('cuando el pago se completa, la misma compra activa la suscripción', async () => {
      const { token, id, cuentaTienda } = await anaConPendiente();
      tienda.verificar.mockResolvedValueOnce(espera(cuentaTienda));
      await c.validar(token, id, { idCompraTienda: 'token-compra-1' });
      tienda.verificar.mockResolvedValueOnce(compraActiva({ cuentaTienda }));

      const respuesta = await c.validar(token, id, { idCompraTienda: 'token-compra-1' });

      expect(respuesta.body.data.estado).toBe('activa');
    });

    it('un primer pago que no se completó deja la suscripción fallida, y reintentar la activa', async () => {
      const { token, id, cuentaTienda } = await anaConPendiente();
      tienda.verificar.mockResolvedValueOnce(
        compraActiva({ cuentaTienda, estado: 'fallida', periodoFin: null, idPagoPasarela: null }),
      );

      const fallida = await c.validar(token, id, { idCompraTienda: 'token-compra-1' });
      tienda.verificar.mockResolvedValueOnce(
        compraActiva({ cuentaTienda, idCompraTienda: 'token-compra-2' }),
      );
      const reintento = await c.validar(token, id, { idCompraTienda: 'token-compra-2' });

      expect(fallida.status).toBe(200);
      expect(fallida.body.data.estado).toBe('fallida');
      expect(reintento.body.data.estado).toBe('activa');
      expect((await c.historial(id)).map((h) => h['estadoNuevo'])).toEqual([
        'pendiente',
        'fallida',
        'activa',
      ]);
      expect(await c.guardada(id)).toMatchObject({ idCompraTienda: 'token-compra-2' });
    });
  });

  describe('cambio de plan (HU-43 esc. 3, CU-12 1.b)', () => {
    async function anaActiva(plan = 'Todas las pruebas mensual', producto = 'todas_mensual') {
      const pruebaId = plan.startsWith('Una') ? base.pruebaId : undefined;
      const ana = await anaConPendiente(plan, pruebaId);
      tienda.verificar.mockResolvedValueOnce(
        compraActiva({ cuentaTienda: ana.cuentaTienda, idProducto: producto }),
      );
      expect(
        (await c.validar(ana.token, ana.id, { idCompraTienda: 'token-compra-1' })).status,
      ).toBe(200);
      return ana;
    }

    it('una compra de otro producto de la misma cuenta cambia el plan y lo registra', async () => {
      const { token, id, cuentaTienda } = await anaActiva();
      c.entorno.avanzarSegundos(60);
      tienda.verificar.mockResolvedValueOnce(
        compraActiva({
          cuentaTienda,
          idCompraTienda: 'token-compra-2',
          idProducto: 'todas_anual',
          idPagoPasarela: 'GPA.0002',
          periodoFin: new Date('2027-11-15T15:00:00.000Z'),
        }),
      );

      const respuesta = await c.validar(token, id, { idCompraTienda: 'token-compra-2' });

      expect(respuesta.status).toBe(200);
      expect(respuesta.body.data).toMatchObject({
        estado: 'activa',
        planId: planes['Todas las pruebas anual'],
        idProducto: 'todas_anual',
      });
      expect((await c.historial(id)).at(-1)).toMatchObject({
        estadoAnterior: 'activa',
        estadoNuevo: 'activa',
        planAnterior: planes['Todas las pruebas mensual'],
        planNuevo: planes['Todas las pruebas anual'],
        origen: 'estudiante',
      });
      expect((await c.pagos(id)).at(-1)).toEqual({
        idPagoPasarela: 'GPA.0002',
        montoClp: 23990,
        estado: 'aprobado',
        periodoInicio: '2026-11-15',
        periodoFin: '2027-11-15',
      });
    });

    it('bajar a Una prueba exige elegir la prueba y la guarda', async () => {
      const { token, id, cuentaTienda } = await anaActiva();
      tienda.verificar.mockResolvedValue(
        compraActiva({
          cuentaTienda,
          idCompraTienda: 'token-compra-2',
          idProducto: 'una_prueba_mensual',
        }),
      );

      const sinPrueba = await c.validar(token, id, { idCompraTienda: 'token-compra-2' });
      const conPrueba = await c.validar(token, id, {
        idCompraTienda: 'token-compra-2',
        pruebaId: base.lectoraId,
      });

      expect(sinPrueba.status).toBe(400);
      expect(sinPrueba.body.error.detalles).toEqual([
        expect.objectContaining({ ruta: 'pruebaId', motivo: 'prueba_requerida' }),
      ]);
      expect(conPrueba.status).toBe(200);
      expect(conPrueba.body.data).toMatchObject({
        planId: planes['Una prueba mensual'],
        pruebaId: base.lectoraId,
      });
      expect(await c.guardada(id)).toMatchObject({ pruebas: [base.lectoraId] });
    });

    it('subir de Una prueba a Todas las pruebas quita la prueba elegida', async () => {
      const { token, id, cuentaTienda } = await anaActiva(
        'Una prueba mensual',
        'una_prueba_mensual',
      );
      tienda.verificar.mockResolvedValue(
        compraActiva({ cuentaTienda, idCompraTienda: 'token-compra-2' }),
      );

      const respuesta = await c.validar(token, id, { idCompraTienda: 'token-compra-2' });

      expect(respuesta.body.data).toMatchObject({
        planId: planes['Todas las pruebas mensual'],
        pruebaId: null,
      });
      expect(await c.guardada(id)).toMatchObject({ pruebas: null });
    });

    it('cambiar solo la prueba de Una prueba queda fuera de HU-43.1 (409)', async () => {
      const { token, id, cuentaTienda } = await anaActiva(
        'Una prueba mensual',
        'una_prueba_mensual',
      );
      tienda.verificar.mockResolvedValue(
        compraActiva({ cuentaTienda, idProducto: 'una_prueba_mensual' }),
      );

      const respuesta = await c.validar(token, id, {
        idCompraTienda: 'token-compra-1',
        pruebaId: base.lectoraId,
      });

      expect(respuesta.status).toBe(409);
      expect(await c.guardada(id)).toMatchObject({ pruebas: [base.pruebaId] });
    });

    it('en la App Store, una bajada rige al renovar: informa el plan y la fecha sin cambiarlo', async () => {
      const { token, id, cuentaTienda } = await anaActiva();
      tienda.verificar.mockResolvedValue(
        compraActiva({
          cuentaTienda,
          tienda: 'app_store',
          productoRenovacion: 'una_prueba_mensual',
        }),
      );

      const respuesta = await c.validar(token, id, { idCompraTienda: 'token-compra-1' });

      expect(respuesta.body.data).toMatchObject({
        planId: planes['Todas las pruebas mensual'],
        cambioEnRenovacion: {
          planId: planes['Una prueba mensual'],
          desde: FIN_MENSUAL.toISOString(),
        },
      });
      expect(await c.historial(id)).toHaveLength(2);
    });
  });
});
