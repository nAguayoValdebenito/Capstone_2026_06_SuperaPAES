// HU-44.2 y HU-45.1 (etapa 5), CU-12 y RN-04, RN-17, RN-26 y RN-34, contra PostgreSQL real: el recorrido
// completo de una suscripción en cada tienda con avisos (la pasarela falsa los da por verificados): compra,
// renovación, cobro fallido con mora, recuperación, cambio de plan, cancelación y vencimiento, comprobando
// en cada paso si cubre la prueba (RN-04) y que el historial no tenga saltos. También el correo de mora
// (CU-12 4.b), que no se envía a una cuenta borrada, y el cierre de respaldo de la tarea horaria.
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Tienda } from '../adaptadores/fabrica.js';
import {
  crearSuscripcionesServicio,
  type SuscripcionesServicio,
} from '../modulos/suscripciones/index.js';
import { avisoDe, enTienda, prepararAvisos } from './avisos-de-prueba.js';
import { exigirBaseEnCi, urlBase } from './base-temporal.js';
import { AHORA, compraActiva, FIN_MENSUAL } from './compras-de-prueba.js';

const FIN_2 = new Date('2027-01-15T15:00:00.000Z');
const FIN_3 = new Date('2027-02-15T15:00:00.000Z');
const RUTA: Record<Tienda, string> = { google_play: 'google-play', app_store: 'app-store' };

exigirBaseEnCi();
describe.skipIf(!urlBase)('recorrido de una suscripción con avisos (HU-44.2)', () => {
  const c = prepararAvisos('recorrido');
  const { base, entorno, tienda, planes } = c;
  let servicio: SuscripcionesServicio;
  let m1: number;
  beforeAll(async () => {
    servicio = crearSuscripcionesServicio({
      bd: entorno.bd,
      unidadDeTrabajo: { enTransaccion: (trabajo) => trabajo(entorno.bd) },
      reloj: () => AHORA,
      pagos: tienda.pagos,
    });
    const { rows } = await entorno.bd.query<{ id: number }>(
      "SELECT id FROM contenido.prueba WHERE codigo = 'M1'",
    );
    m1 = rows[0]?.id ?? 0;
  });

  /** Los correos de mora que la app envió (el buzón de prueba guarda todos los correos). */
  const correosDeMora = () =>
    entorno.correos.filter((m) => m.asunto === 'No se pudo cobrar la renovación de tu plan');

  async function activaEn(t: Tienda, correoEstudiante: string) {
    const { token, id: estudianteId } = await base.sesion(correoEstudiante);
    const { id, cuentaTienda } = await c.pendiente(token, 'Todas las pruebas mensual', {
      tienda: t,
    });
    const compra = `compra-${correoEstudiante}`;
    tienda.verificar.mockResolvedValue(
      compraActiva({ tienda: t, idCompraTienda: compra, cuentaTienda }),
    );
    expect((await c.validar(token, id, { idCompraTienda: compra })).status).toBe(200);
    return { id, token, estudianteId, compra };
  }

  /** Envía a la ruta de la tienda un aviso de esa compra, con lo que la tienda informa. */
  async function aviso(t: Tienda, compra: string, cambios: Parameters<typeof enTienda>[0]) {
    tienda.avisar.mockResolvedValue(avisoDe({ tienda: t, idCompraTienda: compra }));
    tienda.consultar.mockResolvedValue(enTienda({ idCompraTienda: compra, ...cambios }));
    const respuesta = await request(c.appCon({}))
      .post(`/api/v1/webhooks/${RUTA[t]}`)
      .set('Content-Type', 'application/json')
      .send('{}');
    await entorno.esperarSegundoPlano();
    expect(respuesta.status).toBe(200);
  }

  const cubre = (estudianteId: string) => servicio.cubrePrueba(estudianteId, m1, entorno.bd);

  /** El historial no tiene saltos: cada registro parte del estado y el plan del anterior (RN-17). */
  async function sinSaltos(id: number) {
    const historial = await c.historial(id);
    for (const [i, registro] of historial.entries()) {
      const anterior = historial[i - 1];
      if (!anterior) continue;
      expect(registro['estadoAnterior']).toBe(anterior['estadoNuevo']);
      expect(registro['planAnterior']).toBe(anterior['planNuevo']);
    }
    return historial.map((h) => `${String(h['estadoNuevo'])}:${String(h['origen'])}`);
  }

  describe.each<Tienda>(['google_play', 'app_store'])('en %s', (t) => {
    it('compra, renovación, mora, recuperación, cambio de plan, cancelación y vencimiento', async () => {
      const { id, estudianteId, compra } = await activaEn(t, `recorrido-${t}@ejemplo.cl`);
      expect(await cubre(estudianteId)).toBe(true);

      await aviso(t, compra, { periodoFin: FIN_2, idPagoPasarela: `${t}-2` });
      expect(await c.guardada(id)).toMatchObject({ estado: 'activa', periodoFin: FIN_2 });

      await aviso(t, compra, { estado: 'en_mora', periodoFin: FIN_2, idPagoPasarela: null });
      expect(await c.guardada(id)).toMatchObject({ estado: 'en_mora' });
      expect(await cubre(estudianteId)).toBe(true);

      await aviso(t, compra, { periodoFin: FIN_3, idPagoPasarela: `${t}-3` });
      await aviso(t, compra, {
        idProducto: 'todas_anual',
        periodoFin: FIN_3,
        idPagoPasarela: `${t}-4`,
      });
      expect(await c.guardada(id)).toMatchObject({
        estado: 'activa',
        planId: planes['Todas las pruebas anual'],
      });

      await aviso(t, compra, {
        idProducto: 'todas_anual',
        periodoFin: FIN_3,
        idPagoPasarela: `${t}-4`,
        renovacionAutomatica: false,
      });
      expect(await c.guardada(id)).toMatchObject({ estado: 'activa' });
      expect(await cubre(estudianteId)).toBe(true);

      await aviso(t, compra, { estado: 'terminada', fin: 'no_renovo', idProducto: 'todas_anual' });
      expect(await c.guardada(id)).toMatchObject({ estado: 'cancelada', vigente: false });
      expect(await cubre(estudianteId)).toBe(false);

      expect(await sinSaltos(id)).toEqual([
        'pendiente:estudiante',
        'activa:estudiante',
        'en_mora:pasarela',
        'activa:pasarela',
        'activa:pasarela',
        'cancelada:pasarela',
      ]);
      expect((await c.pagos(id)).map((p) => p['idPagoPasarela'])).toEqual([
        'GPA.0001',
        `${t}-2`,
        `${t}-3`,
        `${t}-4`,
      ]);
    });
  });

  describe('correo de mora (CU-12 4.b)', () => {
    it('al entrar en mora se avisa al estudiante una vez, sin datos de la compra', async () => {
      const { compra } = await activaEn('google_play', 'mora-correo@ejemplo.cl');
      const antes = correosDeMora().length;

      await aviso('google_play', compra, { estado: 'en_mora', idPagoPasarela: null });
      await aviso('google_play', compra, { estado: 'en_mora', idPagoPasarela: null });

      const nuevos = correosDeMora().slice(antes);
      expect(nuevos).toHaveLength(1);
      expect(nuevos[0]?.para).toBe('mora-correo@ejemplo.cl');
      expect(nuevos[0]?.texto).toContain('Google Play no pudo cobrar la renovación');
      expect(nuevos[0]?.texto).not.toContain(compra);
    });

    it('una cuenta borrada no recibe el correo, pero el aviso queda en el historial (RN-34)', async () => {
      const { id, token, compra } = await activaEn('app_store', 'borrada@ejemplo.cl');
      const borrado = await request(entorno.app)
        .delete('/api/v1/app/privacidad/cuenta')
        .set('Authorization', `Bearer ${token}`);
      expect(borrado.status).toBe(200);
      const antes = correosDeMora().length;

      await aviso('app_store', compra, { estado: 'en_mora', idPagoPasarela: null });

      expect(correosDeMora()).toHaveLength(antes);
      expect(await c.guardada(id)).toMatchObject({ estado: 'en_mora' });
    });
  });

  describe('cierre de respaldo de la tarea horaria (HU-45.1)', () => {
    it('deja cancelada una activa sin renovación un día después del fin del período', async () => {
      const { id, estudianteId, compra } = await activaEn('google_play', 'respaldo@ejemplo.cl');
      await aviso('google_play', compra, { renovacionAutomatica: false });
      const cerrar = (fecha: Date) =>
        crearSuscripcionesServicio({
          bd: entorno.bd,
          unidadDeTrabajo: { enTransaccion: (trabajo) => trabajo(entorno.bd) },
          reloj: () => fecha,
          pagos: tienda.pagos,
        }).cerrarCanceladasVencidas();

      // Recién terminado el período todavía se espera el aviso de la tienda.
      expect(await cerrar(new Date(FIN_MENSUAL.getTime() + 3_600_000))).toBe(0);
      expect(await cerrar(new Date(FIN_MENSUAL.getTime() + 2 * 86_400_000))).toBe(1);

      expect(await c.guardada(id)).toMatchObject({ estado: 'cancelada' });
      expect(await cubre(estudianteId)).toBe(false);
      expect((await sinSaltos(id)).at(-1)).toBe('cancelada:sistema');
    });

    it('no toca una activa que sigue renovando', async () => {
      const { id } = await activaEn('google_play', 'renueva-sola@ejemplo.cl');

      const cerradas = await crearSuscripcionesServicio({
        bd: entorno.bd,
        unidadDeTrabajo: { enTransaccion: (trabajo) => trabajo(entorno.bd) },
        reloj: () => new Date(FIN_MENSUAL.getTime() + 10 * 86_400_000),
        pagos: tienda.pagos,
      }).cerrarCanceladasVencidas();

      expect(cerradas).toBe(0);
      expect(await c.guardada(id)).toMatchObject({ estado: 'activa' });
    });
  });
});
