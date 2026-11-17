// Campana de la barra superior: «Requiere atención» con lo que hoy espera acción, a partir de los
// mismos contadores del menú (un solo origen de datos). Cada asunto enlaza a su sección. Se cierra con
// Escape o con un clic fuera.
import { useCallback, useRef, useState } from 'react';
import { Link } from 'react-router';
import { useCierreExterno } from '../estado/cierre-externo';
import { type Asunto, asuntosPendientes } from '../estado/asuntos-pendientes';
import type { Contadores } from '../estado/contadores-menu';
import { Icono } from './Icono';

function PanelCampana({ lista, alElegir }: { lista: Asunto[]; alElegir: () => void }) {
  return (
    <div className="campana__panel" id="campana-panel">
      <p className="campana__titulo">Requiere atención</p>
      {lista.length === 0 ? (
        <p className="campana__vacio">No hay nada pendiente.</p>
      ) : (
        <ul>
          {lista.map(({ ruta, texto, seccion, alerta }) => (
            <li key={ruta}>
              <Link to={ruta} onClick={alElegir}>
                <span className={`etiqueta etiqueta--${alerta ? 'atencion' : 'pendiente'}`}>
                  {alerta ? 'Pide acción' : 'Pendiente'}
                </span>
                <span>{texto}</span>
                <span className="campana__seccion">{seccion}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function Campana({ contadores }: { contadores: Contadores }) {
  const [abierta, cambiar] = useState(false);
  const contenedor = useRef<HTMLDivElement>(null);
  const boton = useRef<HTMLButtonElement>(null);
  const cerrar = useCallback((devolverFoco: boolean) => {
    cambiar(false);
    if (devolverFoco) boton.current?.focus();
  }, []);
  useCierreExterno(contenedor, abierta, cerrar);
  const lista = asuntosPendientes(contadores);
  const etiqueta =
    lista.length > 0 ? `Requiere atención (${String(lista.length)})` : 'Requiere atención';

  return (
    <div className="campana" ref={contenedor}>
      <button
        ref={boton}
        type="button"
        className="icono-boton"
        aria-label={etiqueta}
        aria-expanded={abierta}
        aria-controls="campana-panel"
        onClick={() => cambiar((estaba) => !estaba)}
      >
        <Icono nombre="campana" />
        {lista.length > 0 && <span className="campana__punto" aria-hidden="true" />}
      </button>
      {abierta && <PanelCampana lista={lista} alElegir={() => cambiar(false)} />}
    </div>
  );
}
