// Protege una ruta por rol de cuenta. La API vuelve a verificar el rol en cada petición:
// esto solo ordena la navegación, no reemplaza la autorización del servidor.
import type { ReactNode } from 'react';
import { Navigate } from 'react-router';
import { useSesion } from '../estado/contexto-sesion';
import type { RolCuentaInterna } from '../tipos';

export function RutaProtegida({
  roles,
  children,
}: {
  roles: readonly RolCuentaInterna[];
  children: ReactNode;
}) {
  const { usuario } = useSesion();
  if (!usuario) return <Navigate to="/ingreso" replace />;
  if (!roles.includes(usuario.rol)) {
    return (
      <section className="pagina">
        <h1>Acceso restringido</h1>
        <p>No tienes permiso para ver esta sección con el rol {usuario.rol}.</p>
      </section>
    );
  }
  return children;
}
