// Contexto de la sesión del usuario interno y el hook para leerlo.
import { createContext, use } from 'react';
import type { SesionIniciada, UsuarioInterno } from '../tipos';

export interface ValorSesion {
  usuario: UsuarioInterno | null;
  /** Guarda la sesión que entregó la API. Devuelve false si el token no es de un usuario interno. */
  iniciarSesion: (sesion: SesionIniciada) => boolean;
  cerrarSesion: () => void;
}

export const ContextoSesion = createContext<ValorSesion | null>(null);

/**
 * Solo en desarrollo: sesión provisional de admin para navegar sin ingresar. Se usa cuando no hay
 * una sesión guardada y no tiene token, así que la API no la acepta. No puede cambiar de rol.
 * En producción no existe y sin sesión todas las secciones llevan al ingreso.
 */
export const SESION_DESARROLLO: UsuarioInterno | null = import.meta.env.DEV
  ? { id: 'desarrollo', nombre: 'Sesión de desarrollo', rol: 'admin' }
  : null;

/** Si el usuario es la sesión provisional de desarrollo, que no tiene token para la API. */
export function esSesionProvisional(usuario: UsuarioInterno | null): boolean {
  return usuario !== null && SESION_DESARROLLO !== null && usuario.id === SESION_DESARROLLO.id;
}

export function useSesion(): ValorSesion {
  const valor = use(ContextoSesion);
  if (!valor) throw new Error('useSesion debe usarse dentro de ProveedorSesion');
  return valor;
}
