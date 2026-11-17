// Subir y entregar imágenes contra PostgreSQL real (HU-12.6; ver base-temporal.ts): el servicio
// real guarda la imagen y su auditoría en una misma transacción, una imagen repetida no se guarda dos
// veces y la base entrega los mismos bytes que se guardaron.
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Servicios } from '../app.js';
import { type BaseTemporal, exigirBaseEnCi, MINUTO, urlBase } from './base-temporal.js';
import { crearCuenta, prepararBaseDeRevision } from './revision-bd.js';

describe('imágenes de las preguntas sin base de datos', () => {
  exigirBaseEnCi();
});

describe.skipIf(!urlBase)('imágenes de las preguntas con PostgreSQL (HU-12.6)', () => {
  let base: BaseTemporal;
  let servicios: Servicios;
  let admin = '';

  const grafico = (ancho: number) =>
    sharp({ create: { width: ancho, height: 60, channels: 3, background: '#009cd2' } })
      .png()
      .toBuffer();

  const auditorias = async () =>
    (
      await base.bd.query<{ usuario: string; despues: { huella: string } }>(
        `SELECT au.usuario_id::text AS usuario, au.despues
           FROM contenido.auditoria au
           JOIN contenido.accion_auditoria a ON a.id = au.accion_auditoria_id
          WHERE a.codigo = 'subir_imagen' AND au.entidad = 'imagen' ORDER BY au.id`,
      )
    ).rows;

  beforeAll(async () => {
    ({ base, servicios } = await prepararBaseDeRevision('imagenes'));
    admin = await crearCuenta(base.bd, ['admin@imagenes.cl', 'admin']);
  }, MINUTO);
  afterAll(async () => {
    await base.cerrar();
  }, MINUTO);

  it('guarda la imagen y su auditoría, y la base entrega los mismos bytes', async () => {
    const subida = await servicios.preguntas.subirImagen(admin, await grafico(300));

    expect(subida).toMatchObject({ ancho: 300, alto: 60, nueva: true });
    const entregada = await servicios.preguntas.obtenerImagen(subida.huella);
    expect(entregada.length).toBe(subida.bytes);
    expect((await sharp(entregada).metadata()).format).toBe('webp');
    const { rows } = await base.bd.query<{ creado_por: string }>(
      'SELECT creado_por::text FROM contenido.imagen WHERE huella = $1',
      [subida.huella],
    );
    expect(rows[0]?.creado_por).toBe(admin);
    expect((await auditorias()).map((fila) => [fila.usuario, fila.despues.huella])).toContainEqual([
      admin,
      subida.huella,
    ]);
  });

  it('la misma imagen se guarda una sola vez y no repite la auditoría', async () => {
    const archivo = await grafico(310);

    const primera = await servicios.preguntas.subirImagen(admin, archivo);
    const segunda = await servicios.preguntas.subirImagen(admin, archivo);

    expect(segunda).toMatchObject({ id: primera.id, huella: primera.huella, nueva: false });
    const imagenes = await base.bd.query('SELECT 1 FROM contenido.imagen WHERE huella = $1', [
      primera.huella,
    ]);
    expect(imagenes.rowCount).toBe(1);
    const registros = (await auditorias()).filter((fila) => fila.despues.huella === primera.huella);
    expect(registros).toHaveLength(1);
  });

  it('una cuenta que no existe no puede subir y no deja la imagen ni su auditoría', async () => {
    const archivo = await grafico(320);

    await expect(servicios.preguntas.subirImagen('999999', archivo)).rejects.toThrow();

    const { rows } = await base.bd.query<{ n: string }>(
      'SELECT COUNT(*)::text AS n FROM contenido.imagen WHERE ancho = 320',
    );
    expect(rows[0]?.n).toBe('0');
  });

  it('una huella que no existe da 404', async () => {
    await expect(servicios.preguntas.obtenerImagen('f'.repeat(64))).rejects.toMatchObject({
      estadoHttp: 404,
    });
  });
});
