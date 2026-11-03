// Lista de suscripciones (C16, HU-56 esc. 2): estudiante, plan, tienda, estado y desde cuándo. El correo
// abre la línea de tiempo; una cuenta eliminada sale como «Cuenta eliminada». Solo presenta.
import type { SuscripcionDeLaLista } from '../../tipos/suscripciones';
import { estudianteDe, fechaDeChile } from '../../utilidades/suscripciones';

interface Propiedades {
  suscripciones: readonly SuscripcionDeLaLista[];
  /** La suscripción cuya línea de tiempo se ve. */
  elegida: number | undefined;
  alVer: (id: number) => void;
}

export function TablaSuscripciones({ suscripciones, elegida, alVer }: Propiedades) {
  if (suscripciones.length === 0) {
    return <p className="suscripciones__vacio">No hay suscripciones con estos filtros.</p>;
  }
  return (
    <div className="tabla-desplazable">
      <table className="tabla tabla--suscripciones">
        <thead>
          <tr>
            <th scope="col">Estudiante</th>
            <th scope="col">Plan</th>
            <th scope="col">Tienda</th>
            <th scope="col">Estado</th>
            <th scope="col">Desde</th>
          </tr>
        </thead>
        <tbody>
          {suscripciones.map((suscripcion) => (
            <tr
              key={suscripcion.id}
              className={suscripcion.id === elegida ? 'fila--elegida' : undefined}
            >
              <td>
                <button
                  type="button"
                  className="boton-texto"
                  aria-pressed={suscripcion.id === elegida}
                  onClick={() => alVer(suscripcion.id)}
                >
                  {estudianteDe(suscripcion.correo)}
                </button>
              </td>
              <td>{suscripcion.plan}</td>
              <td>{suscripcion.tienda.nombre}</td>
              <td>
                <span className={`etiqueta etiqueta--${suscripcion.estado.codigo}`}>
                  {suscripcion.estado.nombre}
                </span>
              </td>
              <td>{fechaDeChile(suscripcion.creadoEn)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
