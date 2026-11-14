// Diálogo de búsqueda global (Ctrl K): combobox con lista de resultados (listbox) por grupo. El foco
// queda en el campo y la opción activa se anuncia con aria-activedescendant. Flechas, Enter y Escape.
import { useEffect, useRef, type KeyboardEvent } from 'react';
import { useDialogoModal } from '../estado/dialogo-confirmacion';
import type { BusquedaGlobal } from '../estado/busqueda-global';
import { Icono } from './Icono';

const ID_LISTA = 'busqueda-resultados';
const idOpcion = (clave: string) => `busqueda-${clave}`;

function Opciones({ busqueda }: { busqueda: BusquedaGlobal }) {
  const { resultados, indice, elegirResultado } = busqueda;
  return (
    <ul id={ID_LISTA} role="listbox" aria-label="Resultados" className="busqueda__lista">
      {resultados.map((r, i) => {
        // El título del grupo va antes de su primer resultado.
        const titulo = resultados[i - 1]?.grupo === r.grupo ? null : r.grupo;
        return (
          <li key={r.clave} role="presentation">
            {titulo && <p className="busqueda__grupo">{titulo}</p>}
            <div
              id={idOpcion(r.clave)}
              role="option"
              aria-selected={i === indice}
              className="busqueda__opcion"
              onClick={() => elegirResultado(r)}
            >
              <span className="busqueda__titulo">{r.titulo}</span>
              <span className="busqueda__detalle">{r.detalle}</span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function CampoDeBusqueda({ busqueda }: { busqueda: BusquedaGlobal }) {
  const { texto, resultados, indice, cerrar, escribir, mover, elegir } = busqueda;
  const campo = useRef<HTMLInputElement>(null);
  useEffect(() => {
    campo.current?.focus();
  }, []);
  const alPresionar = (evento: KeyboardEvent<HTMLInputElement>) => {
    if (evento.key === 'ArrowDown' || evento.key === 'ArrowUp') {
      evento.preventDefault();
      mover(evento.key === 'ArrowDown' ? 1 : -1);
    } else if (evento.key === 'Enter') {
      evento.preventDefault();
      elegir();
    } else if (evento.key === 'Escape') {
      evento.preventDefault();
      cerrar();
    }
  };
  const activa = resultados[indice];
  return (
    <div className="busqueda__campo">
      <Icono nombre="buscar" />
      <input
        ref={campo}
        type="text"
        role="combobox"
        aria-expanded="true"
        aria-controls={ID_LISTA}
        aria-autocomplete="list"
        aria-activedescendant={activa ? idOpcion(activa.clave) : undefined}
        aria-label="Buscar secciones y preguntas"
        placeholder="Buscar secciones, preguntas por ID o texto"
        autoComplete="off"
        value={texto}
        onChange={(evento) => escribir(evento.target.value)}
        onKeyDown={alPresionar}
      />
      <kbd>Esc</kbd>
    </div>
  );
}

export function BuscadorGlobal({ busqueda }: { busqueda: BusquedaGlobal }) {
  const { abierto, texto, resultados, cerrar } = busqueda;
  const dialogo = useDialogoModal(abierto, cerrar);
  return (
    <dialog ref={dialogo} className="dialogo busqueda" aria-label="Buscar en la consola">
      {abierto && (
        <>
          <CampoDeBusqueda busqueda={busqueda} />
          {resultados.length > 0 ? (
            <Opciones busqueda={busqueda} />
          ) : (
            <p className="busqueda__vacio" role="status">
              Sin resultados para «{texto.trim()}».
            </p>
          )}
        </>
      )}
    </dialog>
  );
}
