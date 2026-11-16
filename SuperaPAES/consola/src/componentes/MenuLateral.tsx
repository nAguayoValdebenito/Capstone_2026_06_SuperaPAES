// Menú lateral con las secciones que el rol de la sesión puede ver, por grupo y en el orden del DAS 7.4.
// Al pie, el menú de la cuenta: el usuario, Cambiar contraseña y Cerrar sesión.
// No hay forma de cambiar de rol: el administrador no ve la consola del docente ni al revés.
// En el teléfono es un cajón (estado/menu-movil.ts): cerrado queda inerte.
import type { RefObject } from 'react';
import { Link, NavLink, useNavigate } from 'react-router';
import { useSesion } from '../estado/contexto-sesion';
import type { Contador, Contadores } from '../estado/contadores-menu';
import type { MenuMovil } from '../estado/menu-movil';
import { gruposDelRol, NOMBRE_ROL_SESION, RUTA_CAMBIAR_CONTRASENA } from '../rutas/secciones';
import { Icono, Logo } from './Icono';

/** Dos iniciales del nombre para el avatar. */
const iniciales = (nombre: string) =>
  nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase() ?? '')
    .join('');

function ContadorSeccion({ contador }: { contador: Contador | undefined }) {
  if (!contador || contador.valor <= 0) return null;
  const { valor, alerta } = contador;
  return (
    <span className={alerta ? 'menu__contador menu__contador--alerta' : 'menu__contador'}>
      <span className="oculto-visual">, </span>
      {valor}
      <span className="oculto-visual"> pendientes</span>
    </span>
  );
}

function Secciones({ contadores, alElegir }: { contadores: Contadores; alElegir: () => void }) {
  const { usuario } = useSesion();
  const grupos = usuario ? gruposDelRol(usuario.rol) : [];
  return (
    <nav aria-label="Secciones de la consola">
      {grupos.map(({ grupo, secciones }) => (
        <div key={grupo} className="menu__grupo">
          <p className="menu__titulo" id={`menu-grupo-${grupo}`}>
            {grupo}
          </p>
          <ul aria-labelledby={`menu-grupo-${grupo}`}>
            {secciones.map((s) => (
              <li key={s.ruta}>
                {/* Sin `end`: /banco/nueva y /banco/:id (C03) también marcan el banco. */}
                <NavLink to={s.ruta} className="menu__enlace" onClick={alElegir}>
                  <Icono nombre={s.icono} />
                  {s.titulo}
                  <ContadorSeccion contador={contadores[s.ruta]} />
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function PieDeSesion() {
  const { usuario, cerrarSesion } = useSesion();
  const navegar = useNavigate();
  if (!usuario) return null;
  const salir = () => {
    cerrarSesion();
    void navegar('/ingreso', { replace: true });
  };
  return (
    <div className="menu__sesion">
      <div className="menu__usuario">
        <span className="avatar" aria-hidden="true">
          {iniciales(usuario.nombre ?? NOMBRE_ROL_SESION[usuario.rol])}
        </span>
        <div className="menu__datos">
          {usuario.nombre && <p className="menu__nombre">{usuario.nombre}</p>}
          <p className="menu__rol">{NOMBRE_ROL_SESION[usuario.rol]}</p>
        </div>
      </div>
      <Link className="menu__salir" to={RUTA_CAMBIAR_CONTRASENA}>
        <Icono nombre="escudo" />
        Cambiar contraseña
      </Link>
      <button className="menu__salir" type="button" onClick={salir}>
        <Icono nombre="salir" />
        Cerrar sesión
      </button>
    </div>
  );
}

export function MenuLateral({
  contadores,
  cajon,
  refMenu,
}: {
  contadores: Contadores;
  cajon: MenuMovil;
  refMenu: RefObject<HTMLElement | null>;
}) {
  const { usuario } = useSesion();
  return (
    <aside className="menu" id="menu-lateral" ref={refMenu} inert={cajon.inerte}>
      <Link className="marca" to="/" onClick={cajon.alElegirSeccion}>
        <Logo />
        <span>
          <span className="menu__marca">
            Supera<span>PAES</span>
          </span>
          {usuario && (
            <span className="menu__subtitulo">Consola · {NOMBRE_ROL_SESION[usuario.rol]}</span>
          )}
        </span>
      </Link>
      <Secciones contadores={contadores} alElegir={cajon.alElegirSeccion} />
      <PieDeSesion />
    </aside>
  );
}
