// HU-44.1 (etapa 4), contra PostgreSQL real: la pasarela de la App Store de verdad (notificaciones
// firmadas con la cadena de prueba y la App Store Server API simulada) conectada al núcleo de avisos por
// la ruta /api/v1/webhooks/app-store. No llama a Apple.
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import type { AvisoEntrante } from '../adaptadores/pagos/pasarela.js';
import { avisoApple, URL_ESTADOS_ORIGINAL } from './app-store-avisos-de-prueba.js';
import {
  AHORA as AHORA_APPLE,
  crearCadena,
  estados,
  ID_ORIGINAL,
  pasarela,
  renovacion,
  transaccion,
} from './app-store-de-prueba.js';
import { prepararAvisos } from './avisos-de-prueba.js';
import { crearDependenciasDePrueba } from './ayudantes.js';
import { exigirBaseEnCi, urlBase } from './base-temporal.js';
import { compraActiva } from './compras-de-prueba.js';
import type { RespuestaFalsa } from './http-falso.js';

const DIA = 86_400_000;
const FIN_RENOVADO = new Date(AHORA_APPLE.getTime() + 60 * DIA);

exigirBaseEnCi();
describe.skipIf(!urlBase)('avisos de la App Store con PostgreSQL (HU-44.1)', () => {
  const c = prepararAvisos('avisosapple');
  const { base, tienda, planes, evento, cambiosDeTienda } = c;

  /** Una suscripción activa de Todas las pruebas mensual comprada en la App Store (ID_ORIGINAL). */
  async function activaEnApple(correo: string) {
    const { token } = await base.sesion(correo);
    const { id, cuentaTienda } = await c.pendiente(token, 'Todas las pruebas mensual', {
      tienda: 'app_store',
    });
    tienda.verificar.mockResolvedValue(
      compraActiva({ tienda: 'app_store', idCompraTienda: ID_ORIGINAL, cuentaTienda }),
    );
    expect((await c.validar(token, id, { idCompraTienda: ID_ORIGINAL })).status).toBe(200);
    return id;
  }

  /** Envía a la ruta el aviso firmado; la App Store Server API responde `estado`. */
  function enviarApple(aviso: AvisoEntrante, estado: RespuestaFalsa) {
    const apple = pasarela({ [URL_ESTADOS_ORIGINAL]: estado }).appStore;
    const app = c.appCon({
      proveedores: {
        ...crearDependenciasDePrueba().proveedores,
        pagos: { google_play: apple, app_store: apple },
      },
    });
    return request(app)
      .post('/api/v1/webhooks/app-store')
      .set('Content-Type', 'application/json')
      .send(aviso.cuerpoCrudo.toString('utf8'));
  }

  it('DID_RENEW verificado alarga el período y registra el cobro de Apple', async () => {
    const id = await activaEnApple('apple-renueva@ejemplo.cl');
    const renovada = transaccion({
      transactionId: '2000000200',
      expiresDate: FIN_RENOVADO.getTime(),
    });
    const aviso = await avisoApple({ tipo: 'DID_RENEW', transaccion: renovada });

    const respuesta = await enviarApple(aviso, {
      estado: 200,
      cuerpo: await estados(1, { transaccion: renovada }),
    });

    expect(respuesta.status).toBe(200);
    expect(await c.guardada(id)).toMatchObject({ estado: 'activa', periodoFin: FIN_RENOVADO });
    expect((await c.pagos(id)).map((p) => p['idPagoPasarela'])).toContain('2000000200');
    expect(await evento(aviso.id)).toEqual([expect.objectContaining({ resultado: 'procesado' })]);
  });

  it('DID_FAIL_TO_RENEW con período de gracia la deja en mora, ligada al aviso', async () => {
    const id = await activaEnApple('apple-mora@ejemplo.cl');
    const aviso = await avisoApple({ tipo: 'DID_FAIL_TO_RENEW', subtipo: 'GRACE_PERIOD' });

    await enviarApple(aviso, { estado: 200, cuerpo: await estados(4) });

    expect(await c.guardada(id)).toMatchObject({ estado: 'en_mora' });
    expect(await cambiosDeTienda(id)).toEqual([
      expect.objectContaining({ estadoNuevo: 'en_mora', aviso: aviso.id }),
    ]);
  });

  it('una bajada (DOWNGRADE) no cambia el plan hasta la renovación', async () => {
    const id = await activaEnApple('apple-baja@ejemplo.cl');
    const aviso = await avisoApple({ tipo: 'DID_CHANGE_RENEWAL_PREF', subtipo: 'DOWNGRADE' });
    const conBajada = await estados(1, {
      renovacion: renovacion({ autoRenewProductId: 'una_prueba_mensual' }),
    });

    await enviarApple(aviso, { estado: 200, cuerpo: conBajada });

    expect(await c.guardada(id)).toMatchObject({
      estado: 'activa',
      planId: planes['Todas las pruebas mensual'],
    });
    expect(await cambiosDeTienda(id)).toEqual([]);
  });

  it('un aviso con una firma ajena responde 400 y no se registra', async () => {
    await activaEnApple('apple-falso@ejemplo.cl');
    const aviso = await avisoApple({ tipo: 'REFUND', conCadena: crearCadena() });

    const respuesta = await enviarApple(aviso, { estado: 200, cuerpo: await estados(5) });

    expect(respuesta.status).toBe(400);
    expect(await evento(aviso.id)).toEqual([]);
  });

  it('REFUND la cancela con el motivo en el historial', async () => {
    const id = await activaEnApple('apple-reembolso@ejemplo.cl');
    const aviso = await avisoApple({ tipo: 'REFUND' });

    await enviarApple(aviso, { estado: 200, cuerpo: await estados(5) });

    expect(await c.guardada(id)).toMatchObject({ estado: 'cancelada' });
    expect(await cambiosDeTienda(id)).toEqual([
      expect.objectContaining({
        estadoNuevo: 'cancelada',
        detalle: 'Reembolso o revocación de la tienda',
      }),
    ]);
  });
});
