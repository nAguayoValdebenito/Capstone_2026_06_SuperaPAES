// HU-44.1 (etapa 3), contra PostgreSQL real: la pasarela de Google Play de verdad (con el token de
// Pub/Sub firmado por las llaves de prueba y la Developer API simulada) conectada al núcleo de avisos
// por la ruta /api/v1/webhooks/google-play. No llama a Google.
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import type { PasarelaGooglePlay } from '../adaptadores/pagos/google-play.js';
import { prepararAvisos, TOKEN } from './avisos-de-prueba.js';
import { crearDependenciasDePrueba } from './ayudantes.js';
import { exigirBaseEnCi, urlBase } from './base-temporal.js';
import {
  envio,
  notificacionDeSuscripcion,
  pasarelaConAvisos,
  tokenPubSub,
} from './google-play-avisos-de-prueba.js';
import { compraDeGoogle, PAQUETE } from './google-play-de-prueba.js';
import type { RespuestaFalsa } from './http-falso.js';

const URL_TOKEN_COMPRA = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PAQUETE}/purchases/subscriptionsv2/tokens/${TOKEN}`;
const FIN_GOOGLE = new Date('2027-04-15T11:59:00.000Z');

exigirBaseEnCi();
describe.skipIf(!urlBase)('avisos de Google Play con PostgreSQL (HU-44.1)', () => {
  const c = prepararAvisos('avisosgoogle');
  const { activa, evento, cambiosDeTienda } = c;
  let mensaje = 0;

  /** La app con la pasarela de Google real; la Developer API responde `compra`. */
  const appConGoogle = (compra: RespuestaFalsa) => {
    const google: PasarelaGooglePlay = pasarelaConAvisos({ [URL_TOKEN_COMPRA]: compra });
    return c.appCon({
      proveedores: {
        ...crearDependenciasDePrueba().proveedores,
        pagos: { google_play: google, app_store: google },
      },
    });
  };

  /** Envía a la ruta el push de Pub/Sub de la notificación, con el token dado. */
  async function pubSub(tipo: number, compra: RespuestaFalsa, token?: string) {
    const id = `pubsub-${String(++mensaje)}`;
    const aviso = envio(notificacionDeSuscripcion(tipo, TOKEN), token ?? (await tokenPubSub()), id);
    const respuesta = await request(appConGoogle(compra))
      .post('/api/v1/webhooks/google-play')
      .set(aviso.encabezados as Record<string, string>)
      .set('Content-Type', 'application/json')
      .send(aviso.cuerpoCrudo.toString('utf8'));
    return { id, respuesta };
  }

  it('una renovación verificada alarga el período y registra el cobro de Google', async () => {
    const { id: suscripcion } = await activa('google-renueva@ejemplo.cl');

    const { id, respuesta } = await pubSub(2, { estado: 200, cuerpo: compraDeGoogle() });

    expect(respuesta.status).toBe(200);
    expect(await c.guardada(suscripcion)).toMatchObject({
      estado: 'activa',
      periodoFin: FIN_GOOGLE,
    });
    expect(await c.pagos(suscripcion)).toEqual([
      expect.objectContaining({ idPagoPasarela: 'GPA.0001' }),
      expect.objectContaining({ idPagoPasarela: 'GPA.3300-0000-0000-00001' }),
    ]);
    expect(await evento(id)).toEqual([expect.objectContaining({ resultado: 'procesado' })]);
  });

  it('la retención de cuenta de Google la deja en mora, ligada al aviso', async () => {
    const { id: suscripcion } = await activa('google-mora@ejemplo.cl');
    const enEspera = compraDeGoogle({ subscriptionState: 'SUBSCRIPTION_STATE_ON_HOLD' });

    const { id } = await pubSub(5, { estado: 200, cuerpo: enEspera });

    expect(await c.guardada(suscripcion)).toMatchObject({ estado: 'en_mora' });
    expect(await cambiosDeTienda(suscripcion)).toEqual([
      expect.objectContaining({ estadoNuevo: 'en_mora', aviso: id }),
    ]);
  });

  it('un envío sin el token de Google responde 401 y no se registra', async () => {
    await activa('google-falso@ejemplo.cl');

    const { id, respuesta } = await pubSub(
      13,
      { estado: 200, cuerpo: compraDeGoogle() },
      await tokenPubSub({ llaveAjena: true }),
    );

    expect(respuesta.status).toBe(401);
    expect(await evento(id)).toEqual([]);
  });

  it('si la Developer API falla, el aviso queda con error y Pub/Sub lo reintenta (503)', async () => {
    await activa('google-caida@ejemplo.cl');

    const { id, respuesta } = await pubSub(2, { estado: 500, cuerpo: {} });

    expect(respuesta.status).toBe(503);
    expect(await evento(id)).toEqual([
      expect.objectContaining({ resultado: 'error', detalle: 'La tienda no respondió' }),
    ]);
  });
});
