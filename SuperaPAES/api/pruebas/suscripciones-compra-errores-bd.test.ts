// HU-43.1, contra PostgreSQL real: lo que no activa una suscripción. Ningún rechazo escribe nada:
// compra de otra cuenta o de otro producto (422), ya registrada en otra suscripción (409), tienda caída
// (503), firma inválida o compra no vigente (422), suscripción ajena (404) o terminada (409). La app no
// puede activar un plan diciendo que pagó: solo cuenta lo que responde la tienda.
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { ErrorCompraNoValida, ErrorTiendaNoDisponible } from '../comun/errores.js';
import { errorConFormato } from './ayudantes.js';
import { exigirBaseEnCi, urlBase } from './base-temporal.js';
import { compraActiva, prepararCompras, RUTA_SUSCRIPCIONES } from './compras-de-prueba.js';
import { insertarSuscripcion } from './suscripciones-de-prueba.js';

exigirBaseEnCi();
describe.skipIf(!urlBase)('compras rechazadas con PostgreSQL (HU-43.1)', () => {
  const c = prepararCompras('compra_errores');
  const { base, entorno, tienda } = c;

  async function conPendiente(correo = 'ana@ejemplo.cl') {
    const { id: estudianteId, token } = await base.sesion(correo);
    const suscripcion = await c.pendiente(token, 'Todas las pruebas mensual');
    return { estudianteId, token, ...suscripcion };
  }

  /** La suscripción sigue pendiente, sin compra, sin pagos y con solo el primer registro. */
  async function sinCambios(id: number) {
    expect(await c.guardada(id)).toMatchObject({ estado: 'pendiente', idCompraTienda: null });
    expect(await c.historial(id)).toHaveLength(1);
    expect(await c.pagos(id)).toEqual([]);
  }

  it.each([
    ['de otra cuenta', { cuentaTienda: '00000000-0000-8000-8000-000000000000' }, 'otra_cuenta'],
    ['sin la cuenta de la app', { cuentaTienda: null }, 'otra_cuenta'],
    ['de otro producto', { idProducto: 'todas_anual' }, 'otro_producto'],
    ['de un producto desconocido', { idProducto: 'monedas_100' }, 'otro_producto'],
  ])(
    'una compra %s: 422 COMPRA_NO_VALIDA (%s) y no escribe nada',
    async (_caso, cambios, motivo) => {
      const { token, id, cuentaTienda } = await conPendiente();
      tienda.verificar.mockResolvedValue(compraActiva({ cuentaTienda, ...cambios }));

      const respuesta = await c.validar(token, id, { idCompraTienda: 'token-compra-1' });

      expect(respuesta.status).toBe(422);
      expect(respuesta.body.error).toMatchObject({
        codigo: 'COMPRA_NO_VALIDA',
        detalles: { motivo },
      });
      await sinCambios(id);
      expect(tienda.confirmar).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['la firma no se pudo comprobar', new ErrorCompraNoValida('firma_invalida'), 422],
    ['la compra ya no está vigente', new ErrorCompraNoValida('no_vigente'), 422],
    ['la tienda no está disponible', new ErrorTiendaNoDisponible(), 503],
  ])('si %s, responde %i y no escribe nada', async (_caso, error, estado) => {
    const { token, id } = await conPendiente();
    tienda.verificar.mockRejectedValue(error);

    const respuesta = await c.validar(token, id, { idCompraTienda: 'token-compra-1' });

    expect(respuesta.status).toBe(estado);
    expect(respuesta.body.error.codigo).toBe(error.codigo);
    await sinCambios(id);
  });

  it('la misma compra en la suscripción de otra cuenta: 409 COMPRA_YA_REGISTRADA', async () => {
    const ana = await conPendiente('ana@ejemplo.cl');
    tienda.verificar.mockResolvedValueOnce(compraActiva({ cuentaTienda: ana.cuentaTienda }));
    await c.validar(ana.token, ana.id, { idCompraTienda: 'token-compra-1' });
    const beto = await conPendiente('beto@ejemplo.cl');
    // La tienda la confirma también con la cuenta de Beto: igual ya pertenece a Ana.
    tienda.verificar.mockResolvedValueOnce(compraActiva({ cuentaTienda: beto.cuentaTienda }));

    const respuesta = await c.validar(beto.token, beto.id, { idCompraTienda: 'token-compra-1' });

    expect(respuesta.status).toBe(409);
    expect(respuesta.body).toEqual(errorConFormato('COMPRA_YA_REGISTRADA'));
    await sinCambios(beto.id);
    expect(await c.guardada(ana.id)).toMatchObject({ estado: 'activa' });
  });

  it('la suscripción de otro estudiante o una inexistente: 404, sin consultar la tienda', async () => {
    const ana = await conPendiente('ana@ejemplo.cl');
    const beto = await base.sesion('beto@ejemplo.cl');

    const ajena = await c.validar(beto.token, ana.id, { idCompraTienda: 'token-compra-1' });
    const inexistente = await c.validar(beto.token, 999_999, { idCompraTienda: 'token-compra-1' });

    expect(ajena.status).toBe(404);
    expect(ajena.body).toEqual(errorConFormato('NO_ENCONTRADO'));
    expect(inexistente.status).toBe(404);
    expect(tienda.verificar).not.toHaveBeenCalled();
    await sinCambios(ana.id);
  });

  it.each(['cancelada', 'vencida'])('una suscripción %s responde 409 CONFLICTO', async (estado) => {
    const { id: estudianteId, token } = await base.sesion('ana@ejemplo.cl');
    const id = Number(
      await insertarSuscripcion(entorno.bd, {
        estudianteId,
        plan: 'Todas las pruebas mensual',
        estado,
      }),
    );

    const respuesta = await c.validar(token, id, { idCompraTienda: 'token-compra-1' });

    expect(respuesta.status).toBe(409);
    expect(respuesta.body).toEqual(errorConFormato('CONFLICTO'));
    expect(tienda.verificar).not.toHaveBeenCalled();
  });

  it('la app no puede activar el plan diciendo que pagó', async () => {
    const { token, id } = await conPendiente();

    // Con la pasarela simulada real: un identificador inventado no es una compra de la tienda.
    const inventada = await c.validar(token, id, { idCompraTienda: 'pagado' }, entorno.app);
    const conEstado = await c.validar(token, id, { idCompraTienda: 'x', estado: 'activa' });

    expect(inventada.status).toBe(422);
    expect(inventada.body.error.detalles).toEqual({ motivo: 'no_encontrada' });
    expect(conEstado.status).toBe(400);
    await sinCambios(id);
  });

  it('valida el identificador de la compra (1 a 200 caracteres) y exige la sesión', async () => {
    const { token, id } = await conPendiente();

    const vacio = await c.validar(token, id, { idCompraTienda: '' });
    const largo = await c.validar(token, id, { idCompraTienda: 'x'.repeat(201) });
    const sinSesion = await request(entorno.app)
      .post(`${RUTA_SUSCRIPCIONES}/${String(id)}/compra`)
      .send({ idCompraTienda: 'token-compra-1' });

    expect(vacio.status).toBe(400);
    expect(largo.status).toBe(400);
    expect(sinSesion.status).toBe(401);
    expect(tienda.verificar).not.toHaveBeenCalled();
  });
});
