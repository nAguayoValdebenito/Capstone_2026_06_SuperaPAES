// HU-44.1 (núcleo), CU-12 pasos 4 y 5, RN-17 y RN-26, contra PostgreSQL real: el aviso ya verificado
// (aquí lo entrega una pasarela falsa) lleva la suscripción al estado que la tienda informa hoy de la
// compra, si RN-26 lo permite, con su historial (origen pasarela, ligado al aviso) y el pago del cobro.
// Las pasarelas de Google Play y de la App Store, con sus firmas, se prueban aparte.
import { describe, expect, it } from 'vitest';
import { avisoDe, enTienda, FIN_SIGUIENTE, prepararAvisos, TOKEN } from './avisos-de-prueba.js';
import { exigirBaseEnCi, urlBase } from './base-temporal.js';
import { FIN_MENSUAL } from './compras-de-prueba.js';

exigirBaseEnCi();
describe.skipIf(!urlBase)('avisos de las tiendas con PostgreSQL (HU-44.1)', () => {
  const c = prepararAvisos('avisos');
  const { tienda, planes, activa, avisar, evento, cambiosDeTienda, canceladaEn } = c;

  describe('cambios de estado (RN-26)', () => {
    it('la renovación alarga el período y registra el cobro, sin cambiar el estado', async () => {
      const { id } = await activa('renueva@ejemplo.cl');
      const aviso = avisoDe();

      const respuesta = await avisar(
        aviso,
        enTienda({ periodoFin: FIN_SIGUIENTE, idPagoPasarela: 'GPA.0001..0' }),
      );

      expect(respuesta.status).toBe(200);
      expect(respuesta.body.data).toEqual({ recibido: true });
      expect(tienda.consultar).toHaveBeenCalledWith(TOKEN);
      expect(await c.guardada(id)).toMatchObject({ estado: 'activa', periodoFin: FIN_SIGUIENTE });
      expect(await c.pagos(id)).toHaveLength(2);
      expect(await evento(aviso.idEvento)).toEqual([
        {
          resultado: 'procesado',
          detalle: null,
          suscripcionId: id,
          conPago: true,
          procesado: true,
        },
      ]);
      expect(await cambiosDeTienda(id)).toEqual([]);
    });

    it('un cobro fallido la deja en mora y el cobro recuperado la vuelve activa', async () => {
      const { id } = await activa('mora@ejemplo.cl');
      const mora = avisoDe({ tipo: 'SUBSCRIPTION_IN_GRACE_PERIOD' });
      const recupera = avisoDe({ tipo: 'SUBSCRIPTION_RECOVERED' });

      await avisar(mora, enTienda({ estado: 'en_mora', idPagoPasarela: null }));
      expect(await c.guardada(id)).toMatchObject({ estado: 'en_mora', vigente: true });

      await avisar(
        recupera,
        enTienda({ periodoFin: FIN_SIGUIENTE, idPagoPasarela: 'GPA.0001..0' }),
      );
      expect(await c.guardada(id)).toMatchObject({ estado: 'activa', periodoFin: FIN_SIGUIENTE });
      const plan = planes['Todas las pruebas mensual'];
      expect(await cambiosDeTienda(id)).toEqual([
        {
          estadoAnterior: 'activa',
          estadoNuevo: 'en_mora',
          planAnterior: plan,
          planNuevo: plan,
          aviso: mora.idEvento,
          detalle: null,
        },
        {
          estadoAnterior: 'en_mora',
          estadoNuevo: 'activa',
          planAnterior: plan,
          planNuevo: plan,
          aviso: recupera.idEvento,
          detalle: null,
        },
      ]);
    });

    it('si la tienda deja de cobrar, una en mora queda vencida', async () => {
      const { id } = await activa('vence@ejemplo.cl');
      await avisar(avisoDe(), enTienda({ estado: 'en_mora', idPagoPasarela: null }));

      await avisar(
        avisoDe({ tipo: 'SUBSCRIPTION_EXPIRED' }),
        enTienda({ estado: 'terminada', fin: 'cobro', idPagoPasarela: null }),
      );

      expect(await c.guardada(id)).toMatchObject({ estado: 'vencida', vigente: false });
    });

    it('una activa que vence por cobro sin período de gracia pasa por en mora (dos registros)', async () => {
      const { id } = await activa('directo@ejemplo.cl');
      const aviso = avisoDe({ tipo: 'SUBSCRIPTION_EXPIRED' });

      await avisar(aviso, enTienda({ estado: 'terminada', fin: 'cobro', idPagoPasarela: null }));

      expect(await c.guardada(id)).toMatchObject({ estado: 'vencida' });
      expect((await cambiosDeTienda(id)).map((h) => [h['estadoNuevo'], h['aviso']])).toEqual([
        ['en_mora', aviso.idEvento],
        ['vencida', aviso.idEvento],
      ]);
    });

    it('cancelar la renovación la mantiene activa hasta el fin del período y luego queda cancelada', async () => {
      const { id } = await activa('cancela@ejemplo.cl');

      await avisar(
        avisoDe({ tipo: 'SUBSCRIPTION_CANCELED' }),
        enTienda({ renovacionAutomatica: false }),
      );
      expect(await c.guardada(id)).toMatchObject({ estado: 'activa', periodoFin: FIN_MENSUAL });
      expect(await canceladaEn(id)).not.toBeNull();

      await avisar(
        avisoDe({ tipo: 'SUBSCRIPTION_EXPIRED' }),
        enTienda({ estado: 'terminada', fin: 'no_renovo', idPagoPasarela: null }),
      );
      expect(await c.guardada(id)).toMatchObject({ estado: 'cancelada', vigente: false });
      expect(await canceladaEn(id)).not.toBeNull();
    });

    it('un reembolso la cancela y lo anota en el historial', async () => {
      const { id } = await activa('reembolso@ejemplo.cl');

      await avisar(
        avisoDe({ tipo: 'VOIDED_PURCHASE' }),
        enTienda({ estado: 'terminada', fin: 'reembolso', idPagoPasarela: null }),
      );

      expect(await c.guardada(id)).toMatchObject({ estado: 'cancelada' });
      expect(await cambiosDeTienda(id)).toEqual([
        expect.objectContaining({
          estadoNuevo: 'cancelada',
          detalle: 'Reembolso o revocación de la tienda',
        }),
      ]);
      expect(await c.pagos(id)).toHaveLength(1);
    });

    it('un cambio de plan informado por la tienda queda en el historial con el plan nuevo', async () => {
      const { id } = await activa('plan@ejemplo.cl');

      await avisar(
        avisoDe({ tipo: 'SUBSCRIPTION_PURCHASED' }),
        enTienda({ idProducto: 'todas_anual', idPagoPasarela: 'GPA.0002' }),
      );

      expect(await c.guardada(id)).toMatchObject({ planId: planes['Todas las pruebas anual'] });
      expect(await cambiosDeTienda(id)).toEqual([
        expect.objectContaining({
          estadoAnterior: 'activa',
          estadoNuevo: 'activa',
          planAnterior: planes['Todas las pruebas mensual'],
          planNuevo: planes['Todas las pruebas anual'],
        }),
      ]);
    });

    it('un cambio que RN-26 no permite se ignora y la suscripción queda igual', async () => {
      const { id } = await activa('final@ejemplo.cl');
      await avisar(
        avisoDe(),
        enTienda({ estado: 'terminada', fin: 'no_renovo', idPagoPasarela: null }),
      );
      const atrasado = avisoDe();

      const respuesta = await avisar(atrasado, enTienda());

      expect(respuesta.status).toBe(200);
      expect(await c.guardada(id)).toMatchObject({ estado: 'cancelada' });
      expect(await evento(atrasado.idEvento)).toEqual([
        expect.objectContaining({
          resultado: 'ignorado',
          detalle: 'Cambio no permitido: cancelada → activa',
        }),
      ]);
    });

    it('un aviso que no cambia nada queda ignorado «sin cambios»', async () => {
      await activa('igual@ejemplo.cl');
      const aviso = avisoDe();

      await avisar(aviso, enTienda());

      expect(await evento(aviso.idEvento)).toEqual([
        expect.objectContaining({ resultado: 'ignorado', detalle: 'Sin cambios', conPago: false }),
      ]);
    });
  });
});
