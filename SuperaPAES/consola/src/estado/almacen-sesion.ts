// Guarda la sesión de la consola en sessionStorage: se borra al cerrar la pestaña y no la comparten
// otras pestañas. Si el navegador bloquea el almacenamiento, la sesión dura solo mientras la página
// esté abierta. Guarda los tokens y, si la hay, la marca de que la cuenta debe cambiar la contraseña
// que le asignó el administrador (nunca el resto de los datos del usuario).
import { esRolCuentaInterna, type SesionIniciada, type UsuarioInterno } from '../tipos';

const CLAVE = 'supera-paes.sesion-consola';

/** Lo que queda guardado: los tokens y la marca de cambio de contraseña pendiente, si la hay. */
export interface SesionGuardada extends SesionIniciada {
  debeCambiarContrasena?: true;
}

function almacen(): Storage | null {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage;
  } catch {
    return null;
  }
}

function esSesionIniciada(valor: unknown): valor is SesionGuardada {
  if (typeof valor !== 'object' || valor === null) return false;
  const { tokenAcceso, tokenRenovacion } = valor as Record<string, unknown>;
  return typeof tokenAcceso === 'string' && typeof tokenRenovacion === 'string';
}

function guardarSesion({ tokenAcceso, tokenRenovacion }: SesionIniciada, cambio: boolean): void {
  const guardada: SesionGuardada = {
    tokenAcceso,
    tokenRenovacion,
    ...(cambio && { debeCambiarContrasena: true }),
  };
  try {
    almacen()?.setItem(CLAVE, JSON.stringify(guardada));
  } catch {
    // Sin almacenamiento disponible: la sesión queda solo en memoria.
  }
}

export function leerSesionGuardada(): SesionGuardada | null {
  try {
    const valor: unknown = JSON.parse(almacen()?.getItem(CLAVE) ?? 'null');
    return esSesionIniciada(valor) ? valor : null;
  } catch {
    return null;
  }
}

export function borrarSesion(): void {
  try {
    almacen()?.removeItem(CLAVE);
  } catch {
    // Nada que borrar si el almacenamiento no está disponible.
  }
}

function leerCargaUtil(token: string): Record<string, unknown> | null {
  const parte = token.split('.')[1];
  if (!parte) return null;
  try {
    const base64 = parte.replace(/-/g, '+').replace(/_/g, '/');
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const carga: unknown = JSON.parse(new TextDecoder().decode(bytes));
    return typeof carga === 'object' && carga !== null ? (carga as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

const esDeLaConsola = (aud: unknown) =>
  aud === 'admin' || (Array.isArray(aud) && aud.includes('admin'));

/**
 * Usuario de la sesión según el token de acceso, o `null` si no es de la consola, venció o no trae
 * un rol interno. La firma no se verifica aquí: el dato solo ordena la navegación y el menú, y la
 * API vuelve a verificar el token y el rol en cada petición.
 */
export function usuarioDelToken(token: string, ahora = Date.now()): UsuarioInterno | null {
  const carga = leerCargaUtil(token);
  if (!carga) return null;
  const { sub, rol, aud, exp } = carga;
  const vigente = typeof exp === 'number' && exp * 1000 > ahora;
  if (!vigente || !esDeLaConsola(aud) || typeof sub !== 'string' || sub === '') return null;
  return typeof rol === 'string' && esRolCuentaInterna(rol) ? { id: sub, rol } : null;
}

/** Si la sesión guardada tiene pendiente el cambio de la contraseña asignada. */
export function cambioPendienteGuardado(): boolean {
  return leerSesionGuardada()?.debeCambiarContrasena === true;
}

/** Pone o quita la marca de cambio pendiente en la sesión guardada (si hay una). */
export function guardarCambioPendiente(pendiente: boolean): void {
  const sesion = leerSesionGuardada();
  if (sesion) guardarSesion(sesion, pendiente);
}

/**
 * Guarda la sesión si su token es de un usuario interno vigente y devuelve ese usuario. La marca de
 * cambio pendiente viene del ingreso; una renovación, que no trae el usuario, conserva la guardada.
 */
export function abrirSesion(sesion: SesionIniciada, ahora = Date.now()): UsuarioInterno | null {
  const usuario = usuarioDelToken(sesion.tokenAcceso, ahora);
  const cambio = sesion.usuario?.debeCambiarContrasena ?? cambioPendienteGuardado();
  if (usuario) guardarSesion(sesion, cambio);
  return usuario;
}

/** Usuario de la sesión guardada, si sigue vigente. */
export function usuarioGuardado(ahora = Date.now()): UsuarioInterno | null {
  const sesion = leerSesionGuardada();
  return sesion ? usuarioDelToken(sesion.tokenAcceso, ahora) : null;
}
