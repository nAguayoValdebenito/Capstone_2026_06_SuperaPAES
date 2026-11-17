import type { ParametroConfiguracion } from '../../tipos/configuracion';
import { ParametroEditable } from './ParametroEditable';

export function FilaParametro({
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
  const descripcion = `configuracion-${parametro.clave}-descripcion`;
  return (
    <li className="configuracion__fila">
      <div>
        <h3>{parametro.nombre}</h3>
        <p id={descripcion}>{parametro.descripcion}</p>
        <p className="configuracion__detalle">
          {parametro.regla} · Último cambio:{' '}
          {new Date(parametro.actualizadoEn).toLocaleString('es-CL')}
          {parametro.actualizadoPor ? ` · ${parametro.actualizadoPor}` : ''}
        </p>
      </div>
      {parametro.editable ? (
        <ParametroEditable
          parametro={parametro}
          borrador={borrador}
          error={error}
          guardando={guardando}
          alCambiar={alCambiar}
          alRevisar={alRevisar}
        />
      ) : (
        <div className="configuracion__lectura">
          <strong>
            {String(parametro.valor)} {parametro.unidad}
          </strong>
          <span>Solo lectura</span>
        </div>
      )}
    </li>
  );
}
