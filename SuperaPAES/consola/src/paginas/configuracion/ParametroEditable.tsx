import { MensajeError } from '../../componentes/MensajeError';
import type { ParametroConfiguracion } from '../../tipos/configuracion';

export function ParametroEditable({
  parametro,
  borrador,
  error,
  guardando,
  alCambiar,
  alRevisar,
}: {
  parametro: ParametroConfiguracion;
  borrador: string | undefined;
  error: string | undefined;
  guardando: boolean;
  alCambiar: (clave: string, texto: string) => void;
  alRevisar: (parametro: ParametroConfiguracion, boton: HTMLButtonElement) => void;
}) {
  const id = `configuracion-${parametro.clave}`;
  const unidad = `${id}-unidad`;
  const errorId = `${id}-error`;
  return (
    <div className="configuracion__edicion">
      <label className="campo" htmlFor={id}>
        Valor de {parametro.nombre}
      </label>
      <div className="configuracion__valor">
        <input
          id={id}
          type="text"
          inputMode={parametro.clave === 'tope_mensual_ia_usd' ? 'decimal' : 'numeric'}
          value={borrador ?? String(parametro.valor)}
          aria-describedby={`${id}-descripcion ${unidad}${error ? ` ${errorId}` : ''}`}
          aria-invalid={Boolean(error)}
          disabled={guardando}
          onChange={(evento) => alCambiar(parametro.clave, evento.target.value)}
        />
        <span id={unidad}>{parametro.unidad}</span>
      </div>
      <MensajeError id={errorId} texto={error} />
      <button
        type="button"
        className="boton"
        disabled={guardando}
        onClick={(evento) => alRevisar(parametro, evento.currentTarget)}
      >
        Revisar cambio
      </button>
    </div>
  );
}
