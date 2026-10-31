// Selector con etiqueta para listas del temario (por id) y listas de opciones (por código). Lo usan los
// filtros del banco (C02) y el formulario de preguntas (C03). Un valor vacío es «sin elegir».
import type { ReactNode } from 'react';
import type { OpcionSelector } from '../utilidades/opciones';

export function Selector({
  etiqueta,
  valor,
  opciones,
  textoVacio = 'Todos',
  deshabilitado = false,
  alCambiar,
  children,
}: {
  etiqueta: string;
  valor: string | number | undefined;
  opciones: readonly OpcionSelector[];
  /** Texto de la opción sin valor; null si siempre hay que elegir una. */
  textoVacio?: string | null;
  deshabilitado?: boolean;
  alCambiar: (valor: string) => void;
  /** Por ejemplo, el mensaje de error del campo. */
  children?: ReactNode;
}) {
  return (
    <label className="campo">
      {etiqueta}
      <select
        value={valor ?? ''}
        disabled={deshabilitado}
        onChange={(evento) => alCambiar(evento.target.value)}
      >
        {textoVacio !== null && <option value="">{textoVacio}</option>}
        {opciones.map((opcion) => (
          <option key={opcion.valor} value={opcion.valor}>
            {opcion.texto}
          </option>
        ))}
      </select>
      {children}
    </label>
  );
}
