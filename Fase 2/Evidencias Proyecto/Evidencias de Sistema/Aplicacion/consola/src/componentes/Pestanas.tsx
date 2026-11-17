// Pestañas de una página con el patrón WAI-ARIA: tablist, tab y tabpanel, aria-selected, tabindex
// itinerante y teclado (flechas, Inicio y Fin). Cambiar de pestaña lo decide quien las usa; el
// contenido de la pestaña elegida va como children y queda dentro de su tabpanel.
import { useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { indiceDestino, useLineaDePestana } from '../estado/pestanas';

interface Opcion<T> {
  valor: T;
  texto: string;
  /** Un color (por ejemplo, el de una prueba) para el sello que va antes del texto. */
  sello?: string;
}

interface Propiedades<T> {
  etiqueta: string;
  opciones: readonly Opcion<T>[];
  valor: T;
  alElegir: (valor: T) => void;
  /** El contenido de la pestaña elegida. */
  children?: ReactNode;
}

function Sello({ color }: { color: string | undefined }) {
  if (!color) return null;
  return <span className="pestanas__sello" aria-hidden="true" style={{ background: color }} />;
}

export function Pestanas<T extends string | number>({
  etiqueta,
  opciones,
  valor,
  alElegir,
  children,
}: Propiedades<T>) {
  const base = useId();
  const lista = useRef<HTMLDivElement>(null);
  useLineaDePestana(lista, valor);
  const idPestana = (v: T) => `${base}-pestana-${String(v)}`;
  const idPanel = children === undefined ? undefined : `${base}-panel`;

  const alPresionar = (evento: KeyboardEvent<HTMLButtonElement>, indice: number) => {
    const destino = opciones[indiceDestino(evento.key, indice, opciones.length) ?? -1];
    if (!destino) return;
    evento.preventDefault();
    alElegir(destino.valor);
    document.getElementById(idPestana(destino.valor))?.focus();
  };

  return (
    <>
      <div className="pestanas" role="tablist" aria-label={etiqueta} ref={lista}>
        {opciones.map((opcion, indice) => (
          <button
            key={opcion.valor}
            id={idPestana(opcion.valor)}
            type="button"
            role="tab"
            className="pestanas__boton"
            aria-selected={opcion.valor === valor}
            aria-controls={idPanel}
            tabIndex={opcion.valor === valor ? 0 : -1}
            onClick={() => alElegir(opcion.valor)}
            onKeyDown={(evento) => alPresionar(evento, indice)}
          >
            <Sello color={opcion.sello} />
            {opcion.texto}
          </button>
        ))}
        <span className="pestanas__linea" aria-hidden="true" />
      </div>
      {idPanel && (
        <div role="tabpanel" id={idPanel} aria-labelledby={idPestana(valor)}>
          {children}
        </div>
      )}
    </>
  );
}
