// Migración 007 (HU-12.6, HU-13.4 y HU-16.6): la tabla contenido.imagen. Solo agrega: ninguna
// tabla existente cambia, una imagen no se modifica ni se borra y cada huella se guarda una sola vez.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { crearBaseTemporal, exigirBaseEnCi, MINUTO, urlBase } from './base-temporal.js';

const insertarImagen = `
  INSERT INTO contenido.imagen (huella, ancho, alto, bytes, datos, creado_por, creado_en)
  VALUES (encode(sha256($1::bytea), 'hex'), 800, 600, octet_length($1::bytea), $1::bytea, $2, now())
  RETURNING id`;

describe('migración de las imágenes sin base', () => {
  exigirBaseEnCi();
});

describe.skipIf(!urlBase)('migración de las imágenes con PostgreSQL', () => {
  let base: Awaited<ReturnType<typeof crearBaseTemporal>>;
  let administrador: string;

  beforeAll(async () => {
    base = await crearBaseTemporal('imagenes');
    const { rows } = await base.bd.query<{ id: string }>(
      `INSERT INTO contenido.usuario_interno (nombre, correo, hash_contrasena, rol_id, creado_en)
       VALUES ('Admin', 'admin@prueba.cl', 'x', (SELECT id FROM contenido.rol WHERE codigo = 'admin'), now())
       RETURNING id`,
    );
    administrador = rows[0]?.id ?? '';
  }, MINUTO);
  afterAll(async () => {
    await base.cerrar();
  }, MINUTO);

  it('la base queda con 86 tablas, 62 en contenido, y 159 claves foráneas', async () => {
    const { rows } = await base.bd.query<{ esquema: string; tablas: string }>(
      `SELECT table_schema AS esquema, COUNT(*)::text AS tablas FROM information_schema.tables
        WHERE table_schema IN ('contenido', 'app') AND table_type = 'BASE TABLE' GROUP BY table_schema`,
    );
    const claves = await base.bd.query<{ total: string }>(
      `SELECT COUNT(*)::text AS total FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace
        WHERE c.contype = 'f' AND n.nspname IN ('contenido', 'app')`,
    );

    expect(Object.fromEntries(rows.map((fila) => [fila.esquema, fila.tablas]))).toEqual({
      contenido: '62',
      app: '24',
    });
    expect(claves.rows[0]?.total).toBe('159');
  });

  it('trae la acción de auditoría subir_imagen', async () => {
    const { rows } = await base.bd.query(
      "SELECT nombre FROM contenido.accion_auditoria WHERE codigo = 'subir_imagen'",
    );
    expect(rows).toHaveLength(1);
  });

  it('guarda una imagen una sola vez por su huella', async () => {
    const datos = Buffer.from('imagen de prueba');
    await base.bd.query(insertarImagen, [datos, administrador]);

    await expect(base.bd.query(insertarImagen, [datos, administrador])).rejects.toThrow(
      /duplicate key|llave duplicada/i,
    );
  });

  it('una imagen guardada no se modifica ni se borra', async () => {
    const { rows } = await base.bd.query<{ id: string }>(insertarImagen, [
      Buffer.from('otra imagen'),
      administrador,
    ]);
    const id = rows[0]?.id;

    await expect(
      base.bd.query('UPDATE contenido.imagen SET ancho = 10 WHERE id = $1', [id]),
    ).rejects.toThrow(/no se modifican ni se borran/);
    await expect(base.bd.query('DELETE FROM contenido.imagen WHERE id = $1', [id])).rejects.toThrow(
      /no se modifican ni se borran/,
    );
  });

  it('rechaza un tamaño que no coincide con los datos', async () => {
    await expect(
      base.bd.query(
        `INSERT INTO contenido.imagen (huella, ancho, alto, bytes, datos, creado_por, creado_en)
         VALUES (repeat('a', 64), 1, 1, 99, '\\x00'::bytea, $1, now())`,
        [administrador],
      ),
    ).rejects.toThrow(/check constraint|restricción/i);
  });
});
