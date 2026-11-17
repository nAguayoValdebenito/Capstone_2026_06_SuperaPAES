// Barra superior de la consola: el botón del menú en el teléfono, las migas (rol, grupo y sección,
// desde rutas/secciones.ts) y el botón de tema claro u oscuro (D4). El usuario y Cerrar sesión siguen
// en el pie del menú.
import type { RefObject } from 'react';
import { Link, useLocation } from 'react-router';
import type { BusquedaGlobal } from '../estado/busqueda-global';
import type { Contadores } from '../estado/contadores-menu';
import { useSesion } from '../estado/contexto-sesion';
import type { MenuMovil } from '../estado/menu-movil';
import { useTema } from '../estado/tema';
import { NOMBRE_ROL_SESION, seccionDeRuta, tituloDeSubpagina } from '../rutas/secciones';
import { Icono } from './Icono';
import { Campana } from './Campana';

function Migas() {
  const { usuario } = useSesion();
  const { pathname } = useLocation();
  const seccion = seccionDeRuta(pathname);
  const subpagina = tituloDeSubpagina(pathname);
  if (!usuario || !seccion?.roles.includes(usuario.rol)) return null;
  return (
    <nav className="migas" aria-label="Ubicación">
      <ol>
        <li>{NOMBRE_ROL_SESION[usuario.rol]}</li>
        <li>{seccion.grupo}</li>
        {subpagina ? (
          <>
            <li>
              <Link to={seccion.ruta}>{seccion.titulo}</Link>
            </li>
            <li aria-current="page">{subpagina}</li>
          </>
        ) : (
          <li aria-current="page">{seccion.titulo}</li>
        )}
      </ol>
    </nav>
  );
}

function BotonTema() {
  const { tema, alternar } = useTema();
  const etiqueta = tema === 'oscuro' ? 'Usar tema claro' : 'Usar tema oscuro';
  return (
    <button
      type="button"
      className="icono-boton"
      onClick={alternar}
      aria-label={etiqueta}
      title={etiqueta}
    >
      <Icono nombre={tema === 'oscuro' ? 'sol' : 'luna'} />
    </button>
  );
}

function BotonBuscar({ busqueda }: { busqueda: BusquedaGlobal }) {
  return (
    <button
      type="button"
      className="buscador"
      onClick={busqueda.abrir}
      aria-haspopup="dialog"
      aria-label="Buscar secciones y preguntas (Ctrl K)"
    >
      <Icono nombre="buscar" />
      <span>Buscar secciones y preguntas</span>
      <kbd>Ctrl K</kbd>
    </button>
  );
}

export function BarraSuperior({
  cajon,
  refBoton,
  busqueda,
  contadores,
}: {
  cajon: MenuMovil;
  refBoton: RefObject<HTMLButtonElement | null>;
  busqueda: BusquedaGlobal;
  contadores: Contadores;
}) {
  return (
    <header className="barra">
      <button
        type="button"
        className="icono-boton barra__menu"
        ref={refBoton}
        aria-label="Menú"
        aria-expanded={cajon.abierto}
        aria-controls="menu-lateral"
        onClick={cajon.abierto ? cajon.cerrar : cajon.abrir}
      >
        <Icono nombre="menu" />
      </button>
      <Migas />
      <div className="barra__acciones">
        <BotonBuscar busqueda={busqueda} />
        <Campana contadores={contadores} />
        <BotonTema />
      </div>
    </header>
  );
}
