// HU-51.1: persistencia y auditoria atomica en una base temporal de pruebas.
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { crearPrimerAdministrador } from '../db/primer-administrador.js';
import { ejecutarEnTransaccion } from '../db/transaccion.js';
import { crearAdministracionServicio } from '../modulos/administracion/index.js';
import { maximoDelDia } from '../modulos/cupo-invitaciones/cupo-invitaciones.cupo.servicio.js';
import { crearBaseTemporal, exigirBaseEnCi, MINUTO, urlBase } from './base-temporal.js';

exigirBaseEnCi();
describe.skipIf(!urlBase)('configuración HU-51.1 con PostgreSQL', () => {
  let base: Awaited<ReturnType<typeof crearBaseTemporal>>;
  let autorId: string;
  const servicio = (fallarAuditoria = false) =>
    crearAdministracionServicio({
      bd: base.bd,
      unidadDeTrabajo: { enTransaccion: (trabajo) => ejecutarEnTransaccion(base.bd, trabajo) },
      revocarSesionesUsuarioInterno: () => Promise.resolve(),
      ...(fallarAuditoria && {
        registrarCambioConfiguracion: () => Promise.reject(new Error('Auditoria interrumpida.')),
      }),
    });

  beforeAll(async () => {
    base = await crearBaseTemporal('hu51');
    const cuenta = await crearPrimerAdministrador(base.bd, {
      nombre: 'Administrador de prueba',
      correo: 'hu51@ejemplo.cl',
      contrasena: randomUUID(),
    });
    autorId = cuenta.id;
  }, MINUTO);

  afterAll(async () => {
    await base.cerrar();
  }, MINUTO);

  it('lista 23 filas y guarda valor, autor, fecha y auditoría; el consumidor lee el nuevo cupo', async () => {
    const admin = servicio();
    const parametros = (await admin.listarConfiguracion()).parametros;
    expect(parametros).toHaveLength(23);
    const anterior = parametros.find((p) => p.clave === 'cupo_inicial')!;
    const nuevo = await admin.cambiarConfiguracion(autorId, anterior.clave, {
      valor: 12,
      actualizadoEn: anterior.actualizadoEn.toISOString(),
    });
    expect(nuevo).toMatchObject({ valor: 12, actualizadoPor: 'Administrador de prueba' });
    expect(nuevo.actualizadoEn.getTime()).toBeGreaterThan(anterior.actualizadoEn.getTime());
    const { rows: cambios } = await base.bd.query<{
      valor: number;
      actualizado_por: string;
      actualizado_en: Date;
    }>(
      'SELECT valor, actualizado_por::text, actualizado_en FROM contenido.configuracion WHERE clave = $1',
      [anterior.clave],
    );
    expect(cambios[0]).toMatchObject({ valor: 12, actualizado_por: autorId });
    const { rows: auditoria } = await base.bd.query<{
      antes: unknown;
      despues: unknown;
      usuario_id: string;
    }>(
      `SELECT a.antes, a.despues, a.usuario_id::text FROM contenido.auditoria a
       JOIN contenido.accion_auditoria x ON x.id = a.accion_auditoria_id
       WHERE x.codigo = 'cambiar_configuracion' AND a.entidad_id = $1`,
      [anterior.clave],
    );
    expect(auditoria).toEqual([
      {
        antes: { clave: anterior.clave, valor: 10 },
        despues: { clave: anterior.clave, valor: 12 },
        usuario_id: autorId,
      },
    ]);
    expect(await maximoDelDia({ administracion: admin }, false)).toBe(12);
  });

  it('si falla la auditoría, la transacción revierte el cambio', async () => {
    const admin = servicio(true);
    const anterior = (await admin.listarConfiguracion()).parametros.find(
      (p) => p.clave === 'cupo_verificado',
    )!;
    await expect(
      admin.cambiarConfiguracion(autorId, anterior.clave, {
        valor: 22,
        actualizadoEn: anterior.actualizadoEn.toISOString(),
      }),
    ).rejects.toThrow('Auditoria interrumpida.');
    const vigente = (await servicio().listarConfiguracion()).parametros.find(
      (p) => p.clave === anterior.clave,
    );
    expect(vigente?.valor).toBe(anterior.valor);
  });
});
