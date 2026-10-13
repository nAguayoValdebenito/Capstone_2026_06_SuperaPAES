// Contexto de la sesión del usuario interno y el hook para leerlo.
import { createContext, use } from 'react';
import type { UsuarioInterno } from '../tipos';

export interface ValorSesion {
  usuario: UsuarioInterno | null;
  cambiarUsuario: (usuario: UsuarioInterno | null) => void;
}

export const ContextoSesion = createContext<ValorSesion | null>(null);

/**
 * Aún no hay ingreso real: en desarrollo se usa una sesión provisional de admin para poder navegar.
 * En producción no hay sesión y todas las secciones redirigen a Ingreso.
 */
export const SESION_DESARROLLO: UsuarioInterno | null = import.meta.env.DEV
  ? { id: 'desarrollo', nombre: 'Sesión de desarrollo', rol: 'admin' }
  : null;

export function useSesion(): ValorSesion {
  const valor = use(ContextoSesion);
  if (!valor) throw new Error('useSesion debe usarse dentro de ProveedorSesion');
  return valor;
}
