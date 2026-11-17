// Comando crear-admin (DAS 4.5.3, TEC-02.2): la lógica de api/db/primer-administrador.ts contra
// PostgreSQL real, en una base temporal con las migraciones (ver base-temporal.ts).
import type pg from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { compararContrasena } from '../comun/contrasenas.js';
import {
  crearPrimerAdministrador,
  describirConexion,
  problemaContrasena,
  problemaCorreo,
  problemaNombre,
  restablecerAdministrador,
} from '../db/primer-administrador.js';
import {
  type BaseTemporal,
  crearBaseTemporal,
  exigirBaseEnCi,
  MINUTO,
  urlBase,
  vaciarCuentasInternas,
} from './base-temporal.js';

describe('crear-admin sin base de datos', () => {
  it('describe la conexión solo con el servidor y el nombre de la base', () => {
    const texto = describirConexion(
      // Dirección inventada para la prueba, no es un secreto. secretlint-disable-next-line
      'postgres://usuario:clave-secreta@ep-x.neon.tech:5432/supera_paes',
    );

    expect(texto).toBe('servidor ep-x.neon.tech:5432, base supera_paes');
    expect(texto).not.toMatch(/usuario|clave-secreta/);
  });

  it('valida nombre, correo y contraseñas antes de tocar la base', () => {
    expect(problemaNombre('  ')).toMatch(/Escribe/);
    expect(problemaNombre('a'.repeat(101))).toMatch(/100/);
    expect(problemaCorreo('no-es-correo')).toMatch(/correo válido/);
    expect(problemaCorreo(`${'a'.repeat(140)}@ejemplo.cl`)).toMatch(/150/);
    expect(problemaContrasena('clave-larga-1', 'clave-larga-2', 'a@b.cl')).toMatch(/no coinciden/);
    expect(problemaContrasena('clave-larga-1', 'clave-larga-1', 'a@b.cl')).toBeNull();
  });

  exigirBaseEnCi();
});

describe.skipIf(!urlBase)('crear-admin con PostgreSQL', () => {
  let base: BaseTemporal;
  let bd: pg.Client;

  const consulta = async <T extends pg.QueryResultRow>(sql: string, valores: unknown[] = []) =>
    (await bd.query<T>(sql, valores)).rows;
  const auditoria = () =>
    consulta<{
      accion: string;
      usuario_id: string;
      entidad_id: string;
      antes: unknown;
      despues: unknown;
    }>(
      `SELECT a.codigo AS accion, x.usuario_id::text, x.entidad_id, x.antes, x.despues
         FROM contenido.auditoria x JOIN contenido.accion_auditoria a ON a.id = x.accion_auditoria_id
        ORDER BY x.id`,
    );
  const hashDe = async (correo: string) =>
    (
      await consulta<{ hash: string }>(
        'SELECT hash_contrasena AS hash FROM contenido.usuario_interno WHERE correo = $1',
        [correo],
      )
    )[0]?.hash ?? '';
  /** Cuenta interna escrita directamente, como si viniera de antes. */
  const insertarCuenta = (correo: string, rol: 'admin' | 'docente', activo: boolean) =>
    bd.query(
      `INSERT INTO contenido.usuario_interno (nombre, correo, hash_contrasena, rol_id, activo, creado_en)
       VALUES ('Previa', $1, 'x', (SELECT id FROM contenido.rol WHERE codigo = $2), $3, now())`,
      [correo, rol, activo],
    );
  const datos = {
    nombre: 'Primer Admin',
    correo: 'Admin@Ejemplo.cl',
    contrasena: 'clave-del-admin',
  };

  beforeAll(async () => {
    base = await crearBaseTemporal('admin');
    bd = base.bd;
  }, MINUTO);

  afterAll(() => base.cerrar(), MINUTO);

  beforeEach(() => vaciarCuentasInternas(bd));

  it('crea la cuenta cuando no hay administrador activo: hash bcrypt y auditoría sin la contraseña', async () => {
    const cuenta = await crearPrimerAdministrador(bd, datos);

    expect(cuenta.correo).toBe('admin@ejemplo.cl');
    const hash = await hashDe('admin@ejemplo.cl');
    expect(hash.startsWith('$2')).toBe(true);
    expect(await compararContrasena('clave-del-admin', hash)).toBe(true);
    expect(await auditoria()).toEqual([
      {
        accion: 'crear_usuario',
        usuario_id: cuenta.id,
        entidad_id: cuenta.id,
        antes: null,
        despues: {
          nombre: 'Primer Admin',
          correo: 'admin@ejemplo.cl',
          rol: 'admin',
          activo: true,
          origen: 'crear-admin',
        },
      },
    ]);
    expect(JSON.stringify(await auditoria())).not.toMatch(/clave-del-admin|\$2/);
  });

  it('no crea nada si ya hay un administrador activo', async () => {
    await insertarCuenta('activo@ejemplo.cl', 'admin', true);

    await expect(crearPrimerAdministrador(bd, datos)).rejects.toThrow(/administrador activo/);
    expect(await consulta('SELECT 1 FROM contenido.usuario_interno')).toHaveLength(1);
    expect(await auditoria()).toHaveLength(0);
  });

  it('crea la cuenta si el único administrador que existe está desactivado', async () => {
    await insertarCuenta('inactivo@ejemplo.cl', 'admin', false);

    await expect(crearPrimerAdministrador(bd, datos)).resolves.toMatchObject({
      correo: 'admin@ejemplo.cl',
    });
  });

  it('rechaza un correo repetido aunque cambien las mayúsculas', async () => {
    await insertarCuenta('admin@ejemplo.cl', 'docente', true);

    await expect(
      crearPrimerAdministrador(bd, { ...datos, correo: 'ADMIN@EJEMPLO.CL' }),
    ).rejects.toThrow(/ya tiene una cuenta/);
    expect(await auditoria()).toHaveLength(0);
  });

  it.each([
    ['de 7 caracteres', 'clave12'],
    ['igual al correo', 'admin@ejemplo.cl'],
  ])('rechaza una contraseña %s', async (_caso, contrasena) => {
    await expect(crearPrimerAdministrador(bd, { ...datos, contrasena })).rejects.toThrow();
    expect(await consulta('SELECT 1 FROM contenido.usuario_interno')).toHaveLength(0);
  });

  it('--restablecer cambia el hash, activa la cuenta y deja editar_usuario con contrasena_cambiada', async () => {
    await insertarCuenta('admin@ejemplo.cl', 'admin', false);

    const cuenta = await restablecerAdministrador(bd, 'Admin@Ejemplo.cl', 'clave-nueva-del-admin');

    expect(
      await compararContrasena('clave-nueva-del-admin', await hashDe('admin@ejemplo.cl')),
    ).toBe(true);
    expect(await consulta('SELECT activo FROM contenido.usuario_interno')).toEqual([
      { activo: true },
    ]);
    expect(await auditoria()).toEqual([
      {
        accion: 'editar_usuario',
        usuario_id: cuenta.id,
        entidad_id: cuenta.id,
        antes: { activo: false },
        despues: { activo: true, contrasena_cambiada: true, origen: 'crear-admin --restablecer' },
      },
    ]);
  });

  it('--restablecer con un correo que no es de administrador no cambia nada', async () => {
    await insertarCuenta('docente@ejemplo.cl', 'docente', false);

    await expect(
      restablecerAdministrador(bd, 'docente@ejemplo.cl', 'clave-nueva-del-docente'),
    ).rejects.toThrow(/No hay un administrador/);
    expect(await hashDe('docente@ejemplo.cl')).toBe('x');
    expect(await consulta('SELECT activo FROM contenido.usuario_interno')).toEqual([
      { activo: false },
    ]);
    expect(await auditoria()).toHaveLength(0);
  });

  it('dos ejecuciones al mismo tiempo crean un solo administrador (pg_advisory_xact_lock)', async () => {
    const otra = await base.conectarOtra();
    try {
      const resultados = await Promise.allSettled([
        crearPrimerAdministrador(bd, datos),
        crearPrimerAdministrador(otra, { ...datos, correo: 'otro@ejemplo.cl' }),
      ]);

      expect(resultados.map((r) => r.status).sort()).toEqual(['fulfilled', 'rejected']);
      expect(await consulta('SELECT 1 FROM contenido.usuario_interno')).toHaveLength(1);
    } finally {
      await otra.end();
    }
  });
});
