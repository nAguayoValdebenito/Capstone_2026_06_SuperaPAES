// Bandeja de avisos con error (C16, HU-56 esc. 4): cada aviso de Google Play o de la App Store que no se
// pudo procesar, con el motivo; si se sabe de qué suscripción es, abre su línea de tiempo. Solo presenta.
import { EstadoVacio } from '../../componentes/EstadoVacio';
import type { AvisoConError } from '../../tipos/suscripciones';
import { fechaDeChile } from '../../utilidades/suscripciones';

interface Propiedades {
  avisos: readonly AvisoConError[];
  alVer: (suscripcionId: number) => void;
}

export function AvisosConError({ avisos, alVer }: Propiedades) {
  if (avisos.length === 0) {
    return <EstadoVacio titulo="No hay avisos con error." />;
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
              <td className="suscripciones__fecha">{fechaDeChile(recibidoEn)}</td>
              <td>{tienda.nombre}</td>
              <td>
                <span className="dato-codigo">{tipo}</span>
              </td>
              <td>{detalle}</td>
              <td>
                {suscripcionId === null ? (
                  <span className="tabla__secundario">Sin asociar</span>
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
