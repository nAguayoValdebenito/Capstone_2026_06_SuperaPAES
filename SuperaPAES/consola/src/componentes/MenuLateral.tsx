// Menú lateral con las secciones que el rol de la sesión puede ver, en el orden del DAS 7.4.
import { NavLink, useNavigate } from 'react-router';
import { useSesion } from '../estado/contexto-sesion';
import { INICIO_POR_ROL, seccionesDelRol } from '../rutas/secciones';
import {
  esRolCuentaInterna,
  ROLES_CUENTA_INTERNA,
  type RolCuentaInterna,
  type UsuarioInterno,
} from '../tipos';

const NOMBRE_ROL: Record<RolCuentaInterna, string> = {
  admin: 'Administrador',
  docente: 'Docente',
};

// Solo en desarrollo, mientras no hay ingreso real: permite revisar el menú de cada rol.
function SelectorRolDesarrollo({ usuario }: { usuario: UsuarioInterno }) {
  const { cambiarUsuario } = useSesion();
  const navegar = useNavigate();
  return (
    <label className="menu__cambio-rol">
      Ver como
      <select
        value={usuario.rol}
        onChange={(evento) => {
          const rol = evento.target.value;
          if (!esRolCuentaInterna(rol)) return;
          cambiarUsuario({ ...usuario, rol });
          void navegar(INICIO_POR_ROL[rol]);
        }}
      >
        {ROLES_CUENTA_INTERNA.map((rol) => (
          <option key={rol} value={rol}>
            {NOMBRE_ROL[rol]}
          </option>
        ))}
      </select>
    </label>
  );
}

export function MenuLateral() {
  const { usuario } = useSesion();
  const visibles = usuario ? seccionesDelRol(usuario.rol) : [];

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
          <p className="menu__nombre">{usuario.nombre}</p>
          <p className="menu__rol">{NOMBRE_ROL[usuario.rol]}</p>
          {import.meta.env.DEV && <SelectorRolDesarrollo usuario={usuario} />}
        </div>
      )}
    </aside>
  );
}
