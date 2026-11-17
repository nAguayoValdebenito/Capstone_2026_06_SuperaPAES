// Lista de suscripciones (C16, HU-56 esc. 2): estudiante, plan, tienda, estado y desde cuándo. El correo
// abre la línea de tiempo; una cuenta eliminada sale como «Cuenta eliminada». La del modo de pruebas
// lleva la etiqueta «Simulada» en vez de una tienda. Solo presenta.
import { EstadoVacio } from '../../componentes/EstadoVacio';
import type { SuscripcionDeLaLista } from '../../tipos/suscripciones';
import { esSimulada, estudianteDe, fechaDeChile } from '../../utilidades/suscripciones';
import { EtiquetaSimulada } from './EtiquetaSimulada';

interface Propiedades {
  suscripciones: readonly SuscripcionDeLaLista[];
  /** La suscripción cuya línea de tiempo se ve. */
  elegida: number | undefined;
  alVer: (id: number) => void;
}

export function TablaSuscripciones({ suscripciones, elegida, alVer }: Propiedades) {
  if (suscripciones.length === 0) {
    return <EstadoVacio titulo="No hay suscripciones con estos filtros." />;
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
              aria-current={suscripcion.id === elegida ? 'true' : undefined}
            >
              <td>
                <button
                  type="button"
                  className="boton-texto suscripciones__correo"
                  aria-pressed={suscripcion.id === elegida}
                  onClick={() => alVer(suscripcion.id)}
                >
                  {estudianteDe(suscripcion.correo)}
                </button>
              </td>
              <td>{suscripcion.plan}</td>
              <td>
                {esSimulada(suscripcion.tienda) ? <EtiquetaSimulada /> : suscripcion.tienda.nombre}
              </td>
              <td>
                <span className={`etiqueta etiqueta--${suscripcion.estado.codigo}`}>
                  {suscripcion.estado.nombre}
                </span>
              </td>
              <td className="suscripciones__fecha">{fechaDeChile(suscripcion.creadoEn)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
