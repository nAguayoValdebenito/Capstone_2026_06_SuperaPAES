// Menú lateral con las secciones que el rol de la sesión puede ver, en el orden del DAS 7.4.
// No hay forma de cambiar de rol: el administrador no ve la consola del docente ni al revés.
import { NavLink, useNavigate } from 'react-router';
import { useSesion } from '../estado/contexto-sesion';
import { seccionesDelRol } from '../rutas/secciones';
import type { RolCuentaInterna } from '../tipos';

const NOMBRE_ROL: Record<RolCuentaInterna, string> = {
  admin: 'Administrador',
  docente: 'Docente',
};

export function MenuLateral() {
  const { usuario, cerrarSesion } = useSesion();
  const navegar = useNavigate();
  const visibles = usuario ? seccionesDelRol(usuario.rol) : [];
  const salir = () => {
    cerrarSesion();
    void navegar('/ingreso', { replace: true });
  };

  return (
    <aside className="menu">
      <p className="menu__marca">Supera PAES</p>
      <nav aria-label="Secciones de la consola">
        <ul>
          {visibles.map((s) => (
            <li key={s.ruta}>
              <NavLink to={s.ruta} end className="menu__enlace">
                {s.titulo}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      {usuario && (
        <div className="menu__sesion">
          {usuario.nombre && <p className="menu__nombre">{usuario.nombre}</p>}
          <p className="menu__rol">{NOMBRE_ROL[usuario.rol]}</p>
          <button className="menu__salir" type="button" onClick={salir}>
            Cerrar sesión
          </button>
        </div>
      )}
    </aside>
  );
}
