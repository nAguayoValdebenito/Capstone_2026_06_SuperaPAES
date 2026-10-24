// Reglas de negocio del módulo cuentas: registro, ingreso, verificación de correo y recuperación de
// contraseña de estudiantes, consentimientos, pruebas elegidas, áreas de carrera de interés,
// puntajes PAES declarados e ingreso del personal interno.
// Es la única puerta de entrada al módulo: los demás módulos usan este servicio, nunca su repositorio.
import { createHash, randomBytes } from 'node:crypto';
import type { ProveedorCorreo } from '../../adaptadores/fabrica.js';
import { cifrarContrasena, compararContrasena } from '../../comun/contrasenas.js';
import { ErrorNoAutenticado, ErrorNoImplementado } from '../../comun/errores.js';
import { firmarToken } from '../../comun/jwt.js';
import { esRolCuentaInterna, type RolCuentaInterna } from '../../comun/roles.js';
import type { Ejecutor, UnidadDeTrabajo } from '../../db/transaccion.js';
import type { AdministracionServicio } from '../administracion/index.js';
import { crearCuentasRepositorio, type CuentasRepositorio } from './cuentas.repositorio.js';
import type { Credenciales, DatosRegistro } from './cuentas.validadores.js';

export interface DependenciasCuentasServicio {
  bd: Ejecutor;
  unidadDeTrabajo: UnidadDeTrabajo;
  correo: ProveedorCorreo;
  administracion: AdministracionServicio;
  /** Secreto de los tokens de la consola (JWT_SECRETO_CONSOLA). */
  secretoConsola: string;
  /** Solo para pruebas: reemplaza al repositorio que se crea con crearCuentasRepositorio(bd). */
  repositorio?: CuentasRepositorio;
}

export interface SesionIniciada {
  tokenAcceso: string;
  tokenRenovacion: string;
}

export interface CuentasServicio {
  registrarEstudiante(datos: DatosRegistro): Promise<SesionIniciada>;
  ingresarEstudiante(credenciales: Credenciales): Promise<SesionIniciada>;
  solicitarRecuperacion(correo: string): Promise<void>;
  /**
   * CU-03 y HU-03: ingreso a la consola. Un correo sin cuenta interna (por ejemplo, el de un
   * estudiante, HU-03 esc. 2), una contraseña incorrecta y una cuenta desactivada (CU-23 3.b) reciben
   * el mismo 401, para no revelar cuál fue.
   */
  ingresarUsuarioInterno(credenciales: Credenciales, dispositivo?: string): Promise<SesionIniciada>;
  /** RNF-01: cambia la credencial de renovación por una sesión nueva, con el rol actual de la cuenta. */
  renovarSesionConsola(tokenRenovacion: string, dispositivo?: string): Promise<SesionIniciada>;
  /** CU-03: cierra la sesión (revocado_en). Una credencial desconocida o ya cerrada no cambia nada. */
  cerrarSesionConsola(tokenRenovacion: string): Promise<void>;
}

/**
 * Vigencia de la credencial de renovación de la consola. El token de acceso dura 15 minutos
 * (comun/jwt.ts); mientras la credencial esté vigente, la consola lo renueva sin pedir la contraseña.
 */
export const HORAS_SESION_CONSOLA = 8;

const CREDENCIALES_INCORRECTAS = 'Correo o contraseña incorrectos.';
const SESION_TERMINADA = 'La sesión venció o se cerró. Vuelve a iniciar sesión.';
/** app.token_sesion.dispositivo es VARCHAR(100). */
const LARGO_DISPOSITIVO = 100;

interface Contexto {
  repositorio: CuentasRepositorio;
  unidadDeTrabajo: UnidadDeTrabajo;
  secretoConsola: string;
}

/** La credencial de renovación solo se guarda cifrada (app.token_sesion.hash_token). */
const cifrarCredencial = (credencial: string) =>
  createHash('sha256').update(credencial).digest('hex');

let hashSinCuenta: Promise<string> | undefined;

/** Un correo sin cuenta tarda lo mismo que una contraseña incorrecta: no se puede adivinar cuál fue. */
async function compararSinCuenta(contrasena: string): Promise<false> {
  hashSinCuenta ??= cifrarContrasena('cuenta-interna-inexistente');
  await compararContrasena(contrasena, await hashSinCuenta);
  return false;
}

async function abrirSesion(
  contexto: Contexto,
  cuenta: { id: string; rol: RolCuentaInterna },
  dispositivo: string | undefined,
  tx: Ejecutor,
): Promise<SesionIniciada> {
  const tokenRenovacion = randomBytes(32).toString('base64url');
  await contexto.repositorio.crearSesionInterna(
    {
      usuarioInternoId: cuenta.id,
      hashToken: cifrarCredencial(tokenRenovacion),
      horasVigencia: HORAS_SESION_CONSOLA,
      dispositivo: dispositivo?.slice(0, LARGO_DISPOSITIVO) ?? null,
    },
    tx,
  );
  const tokenAcceso = await firmarToken(
    'admin',
    { sub: cuenta.id, rol: cuenta.rol },
    contexto.secretoConsola,
  );
  return { tokenAcceso, tokenRenovacion };
}

async function ingresarInterno(
  contexto: Contexto,
  { correo, contrasena }: Credenciales,
  dispositivo?: string,
): Promise<SesionIniciada> {
  const cuenta = await contexto.repositorio.buscarCuentaInternaPorCorreo(correo);
  const coincide = cuenta
    ? await compararContrasena(contrasena, cuenta.hashContrasena)
    : await compararSinCuenta(contrasena);
  if (!cuenta || !coincide || !cuenta.activo || !esRolCuentaInterna(cuenta.rol)) {
    throw new ErrorNoAutenticado(CREDENCIALES_INCORRECTAS);
  }
  const { id, rol } = cuenta;
  return contexto.unidadDeTrabajo.enTransaccion(async (tx) => {
    await contexto.repositorio.registrarAccesoInterno(id, tx);
    return abrirSesion(contexto, { id, rol }, dispositivo, tx);
  });
}

function renovarInterna(
  contexto: Contexto,
  tokenRenovacion: string,
  dispositivo?: string,
): Promise<SesionIniciada> {
  return contexto.unidadDeTrabajo.enTransaccion(async (tx) => {
    const sesion = await contexto.repositorio.buscarSesionInterna(
      cifrarCredencial(tokenRenovacion),
      tx,
    );
    // Una cuenta desactivada o con un rol desconocido no renueva, aunque la credencial siga vigente.
    if (!sesion?.vigente || !sesion.activo || !esRolCuentaInterna(sesion.rol)) {
      throw new ErrorNoAutenticado(SESION_TERMINADA);
    }
    // Rotación: la credencial usada se cierra y se entrega una nueva, con el rol que tiene hoy la cuenta.
    await contexto.repositorio.revocarSesion(sesion.id, tx);
    return abrirSesion(contexto, { id: sesion.usuarioInternoId, rol: sesion.rol }, dispositivo, tx);
  });
}

async function cerrarInterna(contexto: Contexto, tokenRenovacion: string): Promise<void> {
  await contexto.unidadDeTrabajo.enTransaccion(async (tx) => {
    const sesion = await contexto.repositorio.buscarSesionInterna(
      cifrarCredencial(tokenRenovacion),
      tx,
    );
    if (sesion) await contexto.repositorio.revocarSesion(sesion.id, tx);
  });
}

// Los métodos de estudiantes son esqueletos: se implementan en su historia de usuario (HU-01, HU-02).
export function crearCuentasServicio(dependencias: DependenciasCuentasServicio): CuentasServicio {
  const contexto: Contexto = {
    repositorio: dependencias.repositorio ?? crearCuentasRepositorio(dependencias.bd),
    unidadDeTrabajo: dependencias.unidadDeTrabajo,
    secretoConsola: dependencias.secretoConsola,
  };
  return {
    registrarEstudiante: () =>
      Promise.reject(new ErrorNoImplementado('El registro de estudiantes')),
    ingresarEstudiante: () => Promise.reject(new ErrorNoImplementado('El ingreso de estudiantes')),
    solicitarRecuperacion: () =>
      Promise.reject(new ErrorNoImplementado('La recuperación de contraseña')),
    ingresarUsuarioInterno: (credenciales, dispositivo) =>
      ingresarInterno(contexto, credenciales, dispositivo),
    renovarSesionConsola: (token, dispositivo) => renovarInterna(contexto, token, dispositivo),
    cerrarSesionConsola: (token) => cerrarInterna(contexto, token),
  };
}
