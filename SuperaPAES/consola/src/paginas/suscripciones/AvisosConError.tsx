// Bandeja de avisos con error (C16, HU-56 esc. 4): cada aviso de Google Play o de la App Store que no se
// pudo procesar, con el motivo; si se sabe de qué suscripción es, abre su línea de tiempo. Solo presenta.
import type { AvisoConError } from '../../tipos/suscripciones';
import { fechaDeChile } from '../../utilidades/suscripciones';

interface Propiedades {
  avisos: readonly AvisoConError[];
  alVer: (suscripcionId: number) => void;
}

export function AvisosConError({ avisos, alVer }: Propiedades) {
  if (avisos.length === 0) {
    return <p className="suscripciones__vacio">No hay avisos con error.</p>;
  }
  return (
    <div className="tabla-desplazable">
      <table className="tabla">
        <caption>Avisos con error</caption>
        <thead>
          <tr>
            <th scope="col">Recibido</th>
            <th scope="col">Tienda</th>
            <th scope="col">Aviso</th>
            <th scope="col">Motivo del error</th>
            <th scope="col">Suscripción</th>
          </tr>
        </thead>
        <tbody>
          {avisos.map(({ id, recibidoEn, tienda, tipo, detalle, suscripcionId }) => (
            <tr key={id}>
              <td>{fechaDeChile(recibidoEn)}</td>
              <td>{tienda.nombre}</td>
              <td>{tipo}</td>
              <td>{detalle}</td>
              <td>
                {suscripcionId === null ? (
                  'Sin asociar'
                ) : (
                  <button
                    type="button"
                    className="boton-texto"
                    onClick={() => alVer(suscripcionId)}
                  >
                    Ver línea de tiempo
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
