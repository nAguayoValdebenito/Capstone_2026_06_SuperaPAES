// Proveedor del estado de sesión del usuario interno.
import { useState, type ReactNode } from 'react';
import type { UsuarioInterno } from '../tipos';
import { ContextoSesion } from './contexto-sesion';

export function ProveedorSesion({
  sesionInicial,
  children,
}: {
  sesionInicial: UsuarioInterno | null;
  children: ReactNode;
}) {
  const [usuario, cambiarUsuario] = useState(sesionInicial);
  return <ContextoSesion value={{ usuario, cambiarUsuario }}>{children}</ContextoSesion>;
}
