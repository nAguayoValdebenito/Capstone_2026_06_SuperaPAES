// Pestañas de una página: la elegida se marca y cambiarla la decide quien las usa.
export function Pestanas<T extends string | number>({
  etiqueta,
  opciones,
  valor,
  alElegir,
}: {
  etiqueta: string;
  opciones: readonly { valor: T; texto: string }[];
  valor: T;
  alElegir: (valor: T) => void;
}) {
  return (
    <div className="pestanas" role="group" aria-label={etiqueta}>
      {opciones.map((opcion) => (
        <button
          key={opcion.valor}
          type="button"
          className="pestanas__boton"
          aria-pressed={opcion.valor === valor}
          onClick={() => alElegir(opcion.valor)}
        >
          {opcion.texto}
        </button>
      ))}
    </div>
  );
}
