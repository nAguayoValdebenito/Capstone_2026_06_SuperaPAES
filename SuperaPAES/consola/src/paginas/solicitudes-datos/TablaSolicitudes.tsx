// Bandeja de C14 (HU-55 esc. 1): una fila por solicitud, en el orden de la API (las pendientes, la fecha
// límite más próxima primero). Elegir el tipo de una fila abre su detalle al lado.
import { EncabezadoTabla } from '../../componentes/EncabezadoTabla';
import { estudianteDe, fechaChilena, plazoDe } from '../../estado/solicitudes-datos';
import type { SolicitudDeDatos } from '../../tipos/solicitudes-datos';

const COLUMNAS = ['Fecha límite', 'Tipo', 'Estudiante', 'Recibida', 'Estado'] as const;

/** La etiqueta de plazo: texto siempre, y una forma distinta para cada caso (no solo color). */
export function EtiquetaPlazo({ solicitud }: { solicitud: SolicitudDeDatos }) {
  const plazo = plazoDe(solicitud);
  if (!plazo) return null;
  return <span className={`plazo plazo--${plazo.tipo}`}>{plazo.texto}</span>;
}

function FilaSolicitud({
  solicitud,
  elegida,
  alElegir,
}: {
  solicitud: SolicitudDeDatos;
  elegida: boolean;
  alElegir: (id: number) => void;
}) {
  return (
    <tr className={elegida ? 'fila--elegida' : undefined}>
      <td>
        <div className="solicitudes__plazo">
          <span className="solicitudes__fecha">{fechaChilena(solicitud.venceEn)}</span>
          <EtiquetaPlazo solicitud={solicitud} />
        </div>
      </td>
      <td>
        <button
          type="button"
          className="boton-texto"
          aria-pressed={elegida}
          onClick={() => alElegir(solicitud.id)}
        >
          {solicitud.tipo.nombre}
        </button>
      </td>
      <td className="solicitudes__estudiante">{estudianteDe(solicitud)}</td>
      <td className="solicitudes__fecha">{fechaChilena(solicitud.solicitadoEn)}</td>
      <td>
        <span className="etiqueta">{solicitud.estado.nombre}</span>
      </td>
    </tr>
  );
}

export function TablaSolicitudes({
  solicitudes,
  elegida,
  alElegir,
}: {
  solicitudes: readonly SolicitudDeDatos[];
  elegida: number | null;
  alElegir: (id: number) => void;
}) {
  return (
    <div className="tabla-desplazable" role="region" aria-label="Solicitudes de datos" tabIndex={0}>
      <table className="tabla solicitudes__tabla">
        <EncabezadoTabla columnas={COLUMNAS} />
        <tbody>
          {solicitudes.map((solicitud) => (
            <FilaSolicitud
              key={solicitud.id}
              solicitud={solicitud}
              elegida={solicitud.id === elegida}
              alElegir={alElegir}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
