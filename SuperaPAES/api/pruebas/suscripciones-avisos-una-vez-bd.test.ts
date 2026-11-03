// HU-44.1 (núcleo), RN-17, contra PostgreSQL real: cada aviso se registra una sola vez (repetido, dos a
// la vez, o reintentado tras una tienda que no respondió), y una compra que no se reconoce queda
// ignorada, salvo una pendiente que la app no alcanzó a validar, que se liga por la cuenta en la tienda.
import { describe, expect, it } from 'vitest';
import { ErrorTiendaNoDisponible } from '../comun/errores.js';
import { avisoDe, enTienda, prepararAvisos } from './avisos-de-prueba.js';
import { exigirBaseEnCi, urlBase } from './base-temporal.js';

exigirBaseEnCi();
describe.skipIf(!urlBase)('avisos de las tiendas una sola vez con PostgreSQL (HU-44.1)', () => {
  const c = prepararAvisos('avisosunavez');
  const { base, tienda, activa, avisar, enviar, evento, cambiosDeTienda } = c;

  describe('una sola vez (RN-17)', () => {
    it('un aviso repetido responde 200 y no vuelve a cambiar nada', async () => {
      const { id } = await activa('repetido@ejemplo.cl');
      const aviso = avisoDe();
      const mora = enTienda({ estado: 'en_mora', idPagoPasarela: null });

      await avisar(aviso, mora);
      const otra = await avisar(aviso, enTienda({ estado: 'terminada', fin: 'cobro' }));

      expect(otra.status).toBe(200);
      expect(await c.guardada(id)).toMatchObject({ estado: 'en_mora' });
      expect(await evento(aviso.idEvento)).toHaveLength(1);
      expect(await cambiosDeTienda(id)).toHaveLength(1);
    });

    it('dos avisos iguales a la vez se procesan una sola vez', async () => {
      const { id } = await activa('paralelo@ejemplo.cl');
      const aviso = avisoDe();
      tienda.avisar.mockResolvedValue(aviso);
      tienda.consultar.mockResolvedValue(enTienda({ estado: 'en_mora', idPagoPasarela: null }));
      const app = c.appCon({});

      const respuestas = await Promise.all([enviar(app), enviar(app)]);

      expect(respuestas.map((r) => r.status)).toEqual([200, 200]);
      expect(await evento(aviso.idEvento)).toHaveLength(1);
      expect(await cambiosDeTienda(id)).toHaveLength(1);
    });

    it('si la tienda no responde, el aviso queda con error (503) y se procesa al reintentarlo', async () => {
      const { id } = await activa('reintento@ejemplo.cl');
      const aviso = avisoDe();

      const caida = await avisar(aviso, new ErrorTiendaNoDisponible());
      expect(caida.status).toBe(503);
      expect(await evento(aviso.idEvento)).toEqual([
        {
          resultado: 'error',
          detalle: 'La tienda no respondió',
          suscripcionId: null,
          conPago: false,
          procesado: false,
        },
      ]);

      const reintento = await avisar(aviso, enTienda({ estado: 'en_mora', idPagoPasarela: null }));
      expect(reintento.status).toBe(200);
      expect(await evento(aviso.idEvento)).toEqual([
        expect.objectContaining({ resultado: 'procesado', suscripcionId: id, procesado: true }),
      ]);
      expect(await c.guardada(id)).toMatchObject({ estado: 'en_mora' });
    });
  });

  describe('compras que no se reconocen', () => {
    it('una compra desconocida se registra como ignorada', async () => {
      const aviso = avisoDe({ idCompraTienda: 'token-de-nadie' });

      const respuesta = await avisar(aviso, enTienda({ idCompraTienda: 'token-de-nadie' }));

      expect(respuesta.status).toBe(200);
      expect(await evento(aviso.idEvento)).toEqual([
        expect.objectContaining({
          resultado: 'ignorado',
          detalle: 'Compra desconocida',
          suscripcionId: null,
        }),
      ]);
    });

    it('un aviso sin compra (de prueba) se registra como ignorado sin consultar la tienda', async () => {
      const aviso = avisoDe({ tipo: 'TEST', idCompraTienda: null });

      expect((await avisar(aviso)).status).toBe(200);
      expect(tienda.consultar).not.toHaveBeenCalled();
      expect(await evento(aviso.idEvento)).toEqual([
        expect.objectContaining({ resultado: 'ignorado', detalle: 'Aviso sin compra' }),
      ]);
    });

    it('una pendiente que la app no alcanzó a validar se liga por la cuenta en la tienda', async () => {
      const { token } = await base.sesion('sinvalidar@ejemplo.cl');
      const { id, cuentaTienda } = await c.pendiente(token, 'Todas las pruebas mensual');
      const aviso = avisoDe({ tipo: 'SUBSCRIPTION_PURCHASED', idCompraTienda: 'token-nuevo' });

      await avisar(aviso, enTienda({ idCompraTienda: 'token-nuevo', cuentaTienda }));

      expect(await c.guardada(id)).toMatchObject({
        estado: 'activa',
        idCompraTienda: 'token-nuevo',
      });
      expect(await c.pagos(id)).toHaveLength(1);
      expect(await cambiosDeTienda(id)).toEqual([
        expect.objectContaining({
          estadoAnterior: 'pendiente',
          estadoNuevo: 'activa',
          aviso: aviso.idEvento,
        }),
      ]);
    });

    it('una pendiente no se activa con el producto de otro plan', async () => {
      const { token } = await base.sesion('otroplan@ejemplo.cl');
      const { id, cuentaTienda } = await c.pendiente(token, 'Todas las pruebas mensual');
      const aviso = avisoDe({ idCompraTienda: 'token-otro' });

      await avisar(
        aviso,
        enTienda({ idCompraTienda: 'token-otro', cuentaTienda, idProducto: 'una_prueba_mensual' }),
      );

      expect(await c.guardada(id)).toMatchObject({ estado: 'pendiente' });
      expect(await evento(aviso.idEvento)).toEqual([
        expect.objectContaining({ resultado: 'ignorado', detalle: 'Producto desconocido' }),
      ]);
    });
  });
});
