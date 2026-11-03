// Entorno de las pruebas de los avisos de las tiendas (HU-44.1) contra PostgreSQL real: sobre el de las
// compras (HU-43.1), la pasarela falsa entrega el aviso ya verificado y lo que la tienda informa de la
// compra; las pruebas lo envían a la ruta de Google Play y leen el aviso y el historial en la base.
import request from 'supertest';
import { expect } from 'vitest';
import type { AvisoVerificado, SuscripcionEnTienda } from '../adaptadores/fabrica.js';
import { compraActiva, FIN_MENSUAL, prepararCompras } from './compras-de-prueba.js';

export const FIN_SIGUIENTE = new Date('2027-01-15T15:00:00.000Z');
export const TOKEN = 'token-compra-1';

/** Lo que la tienda informa de la compra: activa y renovando, con lo que cambia cada caso. */
export function enTienda(cambios: Partial<SuscripcionEnTienda> = {}): SuscripcionEnTienda {
  return {
    idCompraTienda: TOKEN,
    estado: 'activa',
    fin: null,
    idProducto: 'todas_mensual',
    cuentaTienda: null,
    periodoInicio: null,
    periodoFin: FIN_MENSUAL,
    idPagoPasarela: 'GPA.0001',
    renovacionAutomatica: true,
    ...cambios,
  };
}

let siguienteEvento = 0;

/** Un aviso ya verificado de Google Play, con un id de evento nuevo. */
export const avisoDe = (cambios: Partial<AvisoVerificado> = {}): AvisoVerificado => ({
  tienda: 'google_play',
  idEvento: `msg-${String(++siguienteEvento)}`,
  tipo: 'SUBSCRIPTION_RENEWED',
  idCompraTienda: TOKEN,
  ...cambios,
});

export function prepararAvisos(prefijo: string) {
  const c = prepararCompras(prefijo);
  const { base, entorno, tienda } = c;
  const bd = () => entorno.bd;

  /** Una suscripción activa (Todas las pruebas mensual), con la compra TOKEN de Google Play. */
  async function activa(correo: string, plan = 'Todas las pruebas mensual') {
    const { token } = await base.sesion(correo);
    const { id, cuentaTienda } = await c.pendiente(token, plan);
    tienda.verificar.mockResolvedValue(compraActiva({ cuentaTienda, idCompraTienda: TOKEN }));
    expect((await c.validar(token, id, { idCompraTienda: TOKEN })).status).toBe(200);
    return { id, token, cuentaTienda };
  }

  /** POST a la ruta de Google Play; la pasarela falsa da el aviso por verificado. */
  const enviar = (app = c.appCon({})) =>
    request(app)
      .post('/api/v1/webhooks/google-play')
      .set('Content-Type', 'application/json')
      .send('{}');

  /** Envía el aviso, con lo que la tienda informa de la compra (o el error al consultarla). */
  function avisar(aviso: AvisoVerificado, estado?: SuscripcionEnTienda | Error) {
    tienda.avisar.mockResolvedValue(aviso);
    if (estado instanceof Error) tienda.consultar.mockRejectedValue(estado);
    else if (estado) tienda.consultar.mockResolvedValue(estado);
    return enviar();
  }

  /** El aviso en app.evento_pasarela (una fila, o ninguna). */
  async function evento(idEvento: string) {
    const { rows } = await bd().query<Record<string, unknown>>(
      `SELECT r.codigo AS resultado, a.detalle, a.suscripcion_id::int AS "suscripcionId",
              a.pago_id IS NOT NULL AS "conPago", a.procesado_en IS NOT NULL AS procesado
         FROM app.evento_pasarela a
         JOIN contenido.resultado_evento r ON r.id = a.resultado_evento_id
        WHERE a.id_evento_pasarela = $1`,
      [idEvento],
    );
    return rows;
  }

  /** Los registros del historial que vienen de avisos, con su aviso y su detalle. */
  async function cambiosDeTienda(id: number) {
    const { rows } = await bd().query<Record<string, unknown>>(
      `SELECT ea.codigo AS "estadoAnterior", en.codigo AS "estadoNuevo",
              h.plan_anterior_id AS "planAnterior", h.plan_nuevo_id AS "planNuevo",
              a.id_evento_pasarela AS aviso, h.detalle
         FROM app.suscripcion_evento h
         JOIN contenido.estado_suscripcion ea ON ea.id = h.estado_anterior_id
         JOIN contenido.estado_suscripcion en ON en.id = h.estado_nuevo_id
         JOIN contenido.origen_evento o ON o.id = h.origen_evento_id AND o.codigo = 'pasarela'
         JOIN app.evento_pasarela a ON a.id = h.evento_pasarela_id
        WHERE h.suscripcion_id = $1
        ORDER BY h.creado_en, h.id`,
      [id],
    );
    return rows;
  }

  async function canceladaEn(id: number) {
    const { rows } = await bd().query<{ c: Date | null }>(
      'SELECT cancelada_en AS c FROM app.suscripcion WHERE id = $1',
      [id],
    );
    return rows[0]?.c ?? null;
  }

  return { ...c, activa, enviar, avisar, evento, cambiosDeTienda, canceladaEn };
}
