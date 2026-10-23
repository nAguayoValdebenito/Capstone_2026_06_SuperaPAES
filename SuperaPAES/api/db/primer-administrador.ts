// Primer administrador de la consola (DAS 4.5.3, RF-C02, CU-23, TEC-02.2): lógica del comando crear-admin,
// separada de la entrada por teclado para poder probarla. Vive en db/ (DAS 4.3.5) y escribe con su propio
// SQL contenido.usuario_interno y contenido.auditoria, porque db/ no importa módulos.
// Cada operación es una sola transacción que toma primero pg_advisory_xact_lock: dos ejecuciones al
// mismo tiempo no pueden crear dos administradores. La contraseña ni su hash llegan a la auditoría.
import { z } from 'zod';
import { cifrarContrasena, validarContrasena } from '../comun/contrasenas.js';
import { ejecutarEnTransaccion, type Ejecutor } from './transaccion.js';

// Clave fija del bloqueo de PostgreSQL de crear-admin (las de migrar y semillas son 20270101 y 20270102).
const CLAVE_BLOQUEO = 20270103;
const ENTIDAD = 'usuario_interno';

/** Un error que el comando explica a quien lo ejecuta; nunca cambia la base. */
export class ErrorPrimerAdministrador extends Error {
  override name = 'ErrorPrimerAdministrador';
}

export interface DatosPrimerAdministrador {
  nombre: string;
  correo: string;
  contrasena: string;
}

export interface CuentaAdministrador {
  id: string;
  correo: string;
}

const esquemaCorreo = z.email().max(150);

export function normalizarCorreo(correo: string): string {
  return correo.trim().toLowerCase();
}

/** El nombre tiene de 1 a 100 caracteres. Devuelve el problema, o null si sirve. */
export function problemaNombre(nombre: string): string | null {
  const largo = [...nombre.trim()].length;
  if (largo === 0) return 'Escribe el nombre.';
  return largo > 100 ? 'El nombre tiene más de 100 caracteres.' : null;
}

/** El correo tiene un formato válido y no más de 150 caracteres. */
export function problemaCorreo(correo: string): string | null {
  return esquemaCorreo.safeParse(normalizarCorreo(correo)).success
    ? null
    : 'Ingresa un correo válido de no más de 150 caracteres.';
}

/** Las dos contraseñas coinciden y cumplen RN-31 frente al correo de la cuenta. */
export function problemaContrasena(contrasena: string, repetida: string, correo: string) {
  if (contrasena !== repetida) return 'Las contraseñas no coinciden.';
  return validarContrasena(contrasena, correo);
}

/** Solo el servidor y el nombre de la base: nunca el usuario ni la contraseña de la conexión. */
export function describirConexion(url: string): string {
  const { hostname, port, pathname } = new URL(url);
  const servidor = port ? `${hostname}:${port}` : hostname;
  return `servidor ${servidor}, base ${decodeURIComponent(pathname.slice(1))}`;
}

export async function hayAdministradorActivo(bd: Ejecutor): Promise<boolean> {
  const { rows } = await bd.query<{ hay: boolean }>(
    `SELECT EXISTS (SELECT 1 FROM contenido.usuario_interno u JOIN contenido.rol r ON r.id = u.rol_id
                     WHERE r.codigo = 'admin' AND u.activo) AS hay`,
  );
  return rows[0]?.hay ?? false;
}

export async function correoTieneCuenta(bd: Ejecutor, correo: string): Promise<boolean> {
  const { rows } = await bd.query<{ hay: boolean }>(
    'SELECT EXISTS (SELECT 1 FROM contenido.usuario_interno WHERE lower(correo) = $1) AS hay',
    [normalizarCorreo(correo)],
  );
  return rows[0]?.hay ?? false;
}

/** Administrador (activo o no) con ese correo, sin distinguir mayúsculas. */
export async function buscarAdministrador(
  bd: Ejecutor,
  correo: string,
  bloquear = false,
): Promise<{ id: string; activo: boolean } | null> {
  const { rows } = await bd.query<{ id: string; activo: boolean }>(
    `SELECT u.id::text AS id, u.activo FROM contenido.usuario_interno u
       JOIN contenido.rol r ON r.id = u.rol_id
      WHERE r.codigo = 'admin' AND lower(u.correo) = $1${bloquear ? ' FOR UPDATE OF u' : ''}`,
    [normalizarCorreo(correo)],
  );
  return rows[0] ?? null;
}

function exigir(problema: string | null): void {
  if (problema) throw new ErrorPrimerAdministrador(problema);
}

/** La propia cuenta es la autora: usuario_id (bigint) y entidad_id (texto) llevan el mismo id. */
async function auditar(tx: Ejecutor, id: string, accion: string, cambio: [unknown, unknown]) {
  await tx.query(
    `INSERT INTO contenido.auditoria (usuario_id, accion_auditoria_id, entidad, entidad_id, antes,
                                      despues, creado_en)
     VALUES ($1, (SELECT id FROM contenido.accion_auditoria WHERE codigo = $2), $3, $4, $5, $6, now())`,
    [id, accion, ENTIDAD, id, cambio[0], cambio[1]],
  );
}

/**
 * Crea la cuenta con rol admin y la audita con la propia cuenta como autora. Se niega si ya hay un
 * administrador activo o si el correo ya tiene una cuenta interna.
 */
export async function crearPrimerAdministrador(
  cliente: Ejecutor,
  datos: DatosPrimerAdministrador,
): Promise<CuentaAdministrador> {
  const nombre = datos.nombre.trim();
  const correo = normalizarCorreo(datos.correo);
  exigir(problemaNombre(nombre) ?? problemaCorreo(correo));
  exigir(validarContrasena(datos.contrasena, correo));
  const hash = await cifrarContrasena(datos.contrasena);
  return ejecutarEnTransaccion(cliente, async (tx) => {
    await tx.query('SELECT pg_advisory_xact_lock($1)', [CLAVE_BLOQUEO]);
    if (await hayAdministradorActivo(tx)) {
      throw new ErrorPrimerAdministrador(
        'Ya existe un administrador activo. Las demás cuentas se crean desde Usuarios internos (C10).',
      );
    }
    if (await correoTieneCuenta(tx, correo)) {
      throw new ErrorPrimerAdministrador('Ese correo ya tiene una cuenta interna.');
    }
    const { rows } = await tx.query<{ id: string }>(
      `INSERT INTO contenido.usuario_interno (nombre, correo, hash_contrasena, rol_id, activo, creado_en)
       VALUES ($1, $2, $3, (SELECT id FROM contenido.rol WHERE codigo = 'admin'), true, now())
       RETURNING id::text AS id`,
      [nombre, correo, hash],
    );
    const id = rows[0]?.id;
    if (!id) throw new Error('El INSERT de usuario_interno no devolvió el id.');
    const despues = { nombre, correo, rol: 'admin', activo: true, origen: 'crear-admin' };
    await auditar(tx, id, 'crear_usuario', [null, despues]);
    return { id, correo };
  });
}

/**
 * --restablecer: asigna una contraseña nueva a un administrador que ya existe y lo activa. No crea
 * cuentas. La edición se audita con la misma cuenta como autora.
 */
export async function restablecerAdministrador(
  cliente: Ejecutor,
  correoIngresado: string,
  contrasena: string,
): Promise<CuentaAdministrador> {
  const correo = normalizarCorreo(correoIngresado);
  exigir(validarContrasena(contrasena, correo));
  const hash = await cifrarContrasena(contrasena);
  return ejecutarEnTransaccion(cliente, async (tx) => {
    await tx.query('SELECT pg_advisory_xact_lock($1)', [CLAVE_BLOQUEO]);
    const cuenta = await buscarAdministrador(tx, correo, true);
    if (!cuenta) throw new ErrorPrimerAdministrador('No hay un administrador con ese correo.');
    await tx.query(
      'UPDATE contenido.usuario_interno SET hash_contrasena = $2, activo = true WHERE id = $1',
      [cuenta.id, hash],
    );
    const despues = {
      activo: true,
      contrasena_cambiada: true,
      origen: 'crear-admin --restablecer',
    };
    await auditar(tx, cuenta.id, 'editar_usuario', [{ activo: cuenta.activo }, despues]);
    return { id: cuenta.id, correo };
  });
}
