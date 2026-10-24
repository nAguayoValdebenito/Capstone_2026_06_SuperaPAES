// Usuarios internos contra PostgreSQL real (ver base-temporal.ts): continuidad del administrador con
// dos desactivaciones al mismo tiempo (CU-23 3.c) y la auditoría sin contraseñas ni hash en todas las
// acciones que tocan una cuenta interna (RNF-08): crear, editar con contraseña, desactivar, activar,
// crear-admin y crear-admin --restablecer.
import type pg from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ErrorConflicto } from '../comun/errores.js';
import { crearPrimerAdministrador, restablecerAdministrador } from '../db/primer-administrador.js';
import { ejecutarEnTransaccion } from '../db/transaccion.js';
import { crearAdministracionServicio } from '../modulos/administracion/index.js';
import { crearCuentasServicio } from '../modulos/cuentas/index.js';
import { crearDependenciasDePrueba } from './ayudantes.js';
import {
  type BaseTemporal,
  crearBaseTemporal,
  exigirBaseEnCi,
  MINUTO,
  urlBase,
  vaciarCuentasInternas,
} from './base-temporal.js';

/** El servicio de administración sobre una conexión, cada operación en su propia transacción. */
const servicioSobre = (cliente: pg.Client) =>
  crearAdministracionServicio({
    bd: cliente,
    unidadDeTrabajo: { enTransaccion: (trabajo) => ejecutarEnTransaccion(cliente, trabajo) },
  });

describe('usuarios internos sin base de datos', () => {
  exigirBaseEnCi();
});

describe.skipIf(!urlBase)('usuarios internos con PostgreSQL', () => {
  let base: BaseTemporal;
  let bd: pg.Client;

  const adminsActivos = async () =>
    (
      await bd.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM contenido.usuario_interno u
           JOIN contenido.rol r ON r.id = u.rol_id WHERE r.codigo = 'admin' AND u.activo`,
      )
    ).rows[0]?.n;

  beforeAll(async () => {
    base = await crearBaseTemporal('usuarios');
    bd = base.bd;
  }, MINUTO);

  afterAll(() => base.cerrar(), MINUTO);

  beforeEach(() => vaciarCuentasInternas(bd));

  it('dos desactivaciones simultáneas de los dos últimos administradores: solo una tiene éxito', async () => {
    const uno = await crearPrimerAdministrador(bd, {
      nombre: 'Admin Uno',
      correo: 'uno@ejemplo.cl',
      contrasena: 'clave-del-uno',
    });
    const dos = await servicioSobre(bd).crearUsuarioInterno(uno.id, {
      nombre: 'Admin Dos',
      correo: 'dos@ejemplo.cl',
      rol: 'admin',
      areas: [],
      contrasena: 'clave-del-dos',
    });
    const otra = await base.conectarOtra();
    try {
      // Cada uno intenta desactivar al otro, al mismo tiempo y por conexiones distintas.
      const resultados = await Promise.allSettled([
        servicioSobre(bd).cambiarEstadoUsuarioInterno(uno.id, dos.id, false),
        servicioSobre(otra).cambiarEstadoUsuarioInterno(dos.id, uno.id, false),
      ]);

      expect(resultados.map((r) => r.status).sort()).toEqual(['fulfilled', 'rejected']);
      const rechazo = resultados.find((r) => r.status === 'rejected');
      expect(rechazo?.status === 'rejected' && rechazo.reason).toBeInstanceOf(ErrorConflicto);
      expect(await adminsActivos()).toBe(1);
    } finally {
      await otra.end();
    }
  });

  it('la cuenta del token es vigente solo si existe, está activa y tiene ese rol (HU-03 esc. 3)', async () => {
    const admin = await crearPrimerAdministrador(bd, {
      nombre: 'Admin',
      correo: 'admin@ejemplo.cl',
      contrasena: 'clave-del-admin',
    });
    const servicio = servicioSobre(bd);

    expect(await servicio.cuentaInternaVigente(admin.id, 'admin')).toBe(true);
    expect(await servicio.cuentaInternaVigente(admin.id, 'docente')).toBe(false);
    expect(await servicio.cuentaInternaVigente('999999999', 'admin')).toBe(false);
    await bd.query('UPDATE contenido.usuario_interno SET activo = false WHERE id = $1', [admin.id]);
    expect(await servicio.cuentaInternaVigente(admin.id, 'admin')).toBe(false);
  });

  it('ingreso, renovación y cierre de la consola en app.token_sesion (CU-03, RNF-01)', async () => {
    const admin = await crearPrimerAdministrador(bd, {
      nombre: 'Admin',
      correo: 'admin@ejemplo.cl',
      contrasena: 'clave-del-admin',
    });
    const cuentas = crearCuentasServicio({
      bd,
      unidadDeTrabajo: { enTransaccion: (trabajo) => ejecutarEnTransaccion(bd, trabajo) },
      correo: crearDependenciasDePrueba().proveedores.correo,
      administracion: servicioSobre(bd),
      secretoConsola: 'secreto-de-prueba-con-mas-de-32-caracteres',
    });
    const sesiones = async () =>
      (
        await bd.query<{ hash: string; vigente: boolean; horas: number; dispositivo: string }>(
          `SELECT hash_token AS hash, revocado_en IS NULL AS vigente, dispositivo,
                  round(extract(epoch FROM expira_en - now()) / 3600)::int AS horas
             FROM app.token_sesion WHERE usuario_interno_id = $1 ORDER BY id`,
          [admin.id],
        )
      ).rows;

    await expect(
      cuentas.ingresarUsuarioInterno({ correo: 'admin@ejemplo.cl', contrasena: 'otra-clave' }),
    ).rejects.toThrow('Correo o contraseña incorrectos.');
    const sesion = await cuentas.ingresarUsuarioInterno(
      { correo: 'ADMIN@ejemplo.cl', contrasena: 'clave-del-admin' },
      'Navegador',
    );
    const [primera] = await sesiones();
    expect(primera).toMatchObject({ vigente: true, horas: 8, dispositivo: 'Navegador' });
    expect(primera?.hash).not.toBe(sesion.tokenRenovacion);
    const { rows: acceso } = await bd.query<{ ultimo: Date | null }>(
      'SELECT ultimo_acceso AS ultimo FROM contenido.usuario_interno WHERE id = $1',
      [admin.id],
    );
    expect(acceso[0]?.ultimo).toBeInstanceOf(Date);

    const renovada = await cuentas.renovarSesionConsola(sesion.tokenRenovacion);
    expect((await sesiones()).map((s) => s.vigente)).toEqual([false, true]);
    await expect(cuentas.renovarSesionConsola(sesion.tokenRenovacion)).rejects.toThrow(/venció/);

    await cuentas.cerrarSesionConsola(renovada.tokenRenovacion);
    expect((await sesiones()).map((s) => s.vigente)).toEqual([false, false]);
    await expect(cuentas.renovarSesionConsola(renovada.tokenRenovacion)).rejects.toThrow(/venció/);
  });

  it('ninguna fila de la auditoría guarda una contraseña ni su hash (RNF-08)', async () => {
    const claves = [
      'clave-inicial-admin',
      'clave-restablecida',
      'clave-del-docente',
      'clave-nueva-doc',
    ];
    const admin = await crearPrimerAdministrador(bd, {
      nombre: 'Admin',
      correo: 'admin@ejemplo.cl',
      contrasena: claves[0] ?? '',
    });
    await restablecerAdministrador(bd, 'admin@ejemplo.cl', claves[1] ?? '');
    const { rows: areas } = await bd.query<{ id: number }>(
      `INSERT INTO contenido.area (nombre) VALUES ('Área de prueba')
       ON CONFLICT (nombre) DO UPDATE SET nombre = EXCLUDED.nombre RETURNING id`,
    );
    const servicio = servicioSobre(bd);
    const docente = await servicio.crearUsuarioInterno(admin.id, {
      nombre: 'Docente',
      correo: 'docente@ejemplo.cl',
      rol: 'docente',
      areas: areas.map((a) => a.id),
      contrasena: claves[2] ?? '',
    });
    await servicio.editarUsuarioInterno(admin.id, docente.id, { contrasena: claves[3] ?? '' });
    await servicio.cambiarEstadoUsuarioInterno(admin.id, docente.id, false);
    await servicio.cambiarEstadoUsuarioInterno(admin.id, docente.id, true);

    const { rows } = await bd.query<{ accion: string; antes: unknown; despues: unknown }>(
      `SELECT a.codigo AS accion, x.antes, x.despues FROM contenido.auditoria x
         JOIN contenido.accion_auditoria a ON a.id = x.accion_auditoria_id ORDER BY x.id`,
    );
    expect(rows.map((r) => r.accion)).toEqual([
      'crear_usuario',
      'editar_usuario',
      'crear_usuario',
      'editar_usuario',
      'desactivar_usuario',
      'activar_usuario',
    ]);
    const { rows: hashes } = await bd.query<{ h: string }>(
      'SELECT hash_contrasena AS h FROM contenido.usuario_interno',
    );
    for (const fila of rows) {
      const texto = JSON.stringify([fila.antes, fila.despues]);
      for (const clave of [...claves, ...hashes.map((h) => h.h)])
        expect(texto).not.toContain(clave);
      expect(texto).not.toMatch(/\$2[aby]\$|hash/i);
      expect(texto).not.toMatch(/"contrasena"/);
    }
    // Al cambiar la contraseña queda solo la marca, en el restablecimiento y en la edición.
    expect(rows[1]?.despues).toMatchObject({ contrasena_cambiada: true });
    expect(rows[3]?.despues).toMatchObject({ contrasena_cambiada: true });
  });
});
