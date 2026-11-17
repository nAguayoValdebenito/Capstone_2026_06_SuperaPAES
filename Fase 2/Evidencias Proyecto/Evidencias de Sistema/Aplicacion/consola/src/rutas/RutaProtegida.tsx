// Protege una ruta por rol de cuenta (HU-03 esc. 3): sin sesión lleva al ingreso y con un rol sin
// permiso, a la sección de entrada de su rol. La API vuelve a verificar el rol en cada petición:
// esto solo ordena la navegación, no reemplaza la autorización del servidor.
import type { ReactNode } from 'react';
import { Navigate } from 'react-router';
import { useSesion } from '../estado/contexto-sesion';
import type { RolCuentaInterna } from '../tipos';
import { redireccionDeRuta } from './secciones';

export function RutaProtegida({
  roles,
  children,
}: {
  roles: readonly RolCuentaInterna[];
  children: ReactNode;
}) {
  const { usuario } = useSesion();
  const destino = redireccionDeRuta(usuario, roles);
  return destino ? <Navigate to={destino} replace /> : children;
}
