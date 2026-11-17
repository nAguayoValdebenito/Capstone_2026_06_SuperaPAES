// Guarda la sesión de la consola en sessionStorage: se borra al cerrar la pestaña y no la comparten
// otras pestañas. Si el navegador bloquea el almacenamiento, la sesión dura solo mientras la página
// esté abierta.
import { esRolCuentaInterna, type SesionIniciada, type UsuarioInterno } from '../tipos';

const CLAVE = 'supera-paes.sesion-consola';

function almacen(): Storage | null {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage;
  } catch {
    return null;
  }
}

/** Lo que se guarda: los dos tokens y el nombre de la cuenta para el menú (nada más). */
interface SesionGuardada {
  tokenAcceso: string;
  tokenRenovacion: string;
  nombre?: string;
}

function esSesionGuardada(valor: unknown): valor is SesionGuardada {
  if (typeof valor !== 'object' || valor === null) return false;
  const { tokenAcceso, tokenRenovacion, nombre } = valor as Record<string, unknown>;
  return (
    typeof tokenAcceso === 'string' &&
    typeof tokenRenovacion === 'string' &&
    (nombre === undefined || typeof nombre === 'string')
  );
}

function guardarSesion(sesion: SesionGuardada): void {
  try {
    almacen()?.setItem(CLAVE, JSON.stringify(sesion));
  } catch {
    // Sin almacenamiento disponible: la sesión queda solo en memoria.
  }
}

export function leerSesionGuardada(): SesionGuardada | null {
  try {
    const valor: unknown = JSON.parse(almacen()?.getItem(CLAVE) ?? 'null');
    return esSesionGuardada(valor) ? valor : null;
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

/** Guarda la sesión si su token es de un usuario interno vigente y devuelve ese usuario. */
export function abrirSesion(sesion: SesionIniciada, ahora = Date.now()): UsuarioInterno | null {
  const usuario = usuarioDelToken(sesion.tokenAcceso, ahora);
  if (!usuario) return null;
  const nombre = nombreDeLaCuenta(usuario.id, sesion);
  const { tokenAcceso, tokenRenovacion } = sesion;
  guardarSesion(
    nombre ? { tokenAcceso, tokenRenovacion, nombre } : { tokenAcceso, tokenRenovacion },
  );
  return nombre ? { ...usuario, nombre } : usuario;
}

/**
 * Nombre que muestra el menú: el de la cuenta que entrega el ingreso o, al renovar (la renovación no
 * lo trae), el guardado de la misma cuenta.
 */
function nombreDeLaCuenta(id: string, sesion: SesionIniciada): string | undefined {
  if (sesion.usuario?.id === id && sesion.usuario.nombre) return sesion.usuario.nombre;
  const anterior = leerSesionGuardada();
  if (!anterior?.nombre) return undefined;
  // Con `ahora = 0` solo importa de quién es el token anterior, no si sigue vigente.
  return usuarioDelToken(anterior.tokenAcceso, 0)?.id === id ? anterior.nombre : undefined;
}

/** Usuario de la sesión guardada, si sigue vigente. */
export function usuarioGuardado(ahora = Date.now()): UsuarioInterno | null {
  const sesion = leerSesionGuardada();
  const usuario = sesion ? usuarioDelToken(sesion.tokenAcceso, ahora) : null;
  return usuario && sesion?.nombre ? { ...usuario, nombre: sesion.nombre } : usuario;
}
