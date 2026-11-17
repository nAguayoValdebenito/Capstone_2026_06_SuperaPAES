// Diseño general de la consola: «Saltar al contenido», menú lateral (cajón en el teléfono), barra
// superior y el contenido de la sección, que recibe el foco al navegar.
import { useRef } from 'react';
import { Outlet } from 'react-router';
import { useBusquedaGlobal } from '../estado/busqueda-global';
import { useContadoresMenu } from '../estado/contadores-menu';
import { esSesionProvisional, useSesion } from '../estado/contexto-sesion';
import { useEtiquetasDeTabla } from '../estado/etiquetas-de-tabla';
import { useFocoAlNavegar } from '../estado/foco-al-navegar';
import { useMenuMovil } from '../estado/menu-movil';
import { AyudaAtajos } from './AyudaAtajos';
import { BarraSuperior } from './BarraSuperior';
import { BuscadorGlobal } from './BuscadorGlobal';
import { MenuLateral } from './MenuLateral';

export function DisenoGeneral() {
  const { usuario } = useSesion();
  const botonMenu = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLElement>(null);
  const cajon = useMenuMovil(botonMenu, menu);
  const contadores = useContadoresMenu(usuario?.rol ?? null, !esSesionProvisional(usuario));
  const busqueda = useBusquedaGlobal(usuario?.rol ?? null);
  const principal = useRef<HTMLElement>(null);
  useFocoAlNavegar(principal);
  useEtiquetasDeTabla(principal);

  return (
    <div className="diseno" data-menu-abierto={cajon.abierto}>
      <a className="saltar" href="#contenido">
        Saltar al contenido
      </a>
      <MenuLateral contadores={contadores} cajon={cajon} refMenu={menu} />
      <div className="velo" aria-hidden="true" onClick={cajon.cerrar} />
      <div className="principal">
        <BarraSuperior
          cajon={cajon}
          refBoton={botonMenu}
          busqueda={busqueda}
          contadores={contadores}
        />
        <main className="contenido" id="contenido" tabIndex={-1} ref={principal}>
          <Outlet />
        </main>
      </div>
      <BuscadorGlobal busqueda={busqueda} />
      <AyudaAtajos abierta={busqueda.ayuda} alCerrar={busqueda.cerrarAyuda} />
    </div>
  );
}
