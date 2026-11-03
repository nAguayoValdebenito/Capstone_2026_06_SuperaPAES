// Línea de tiempo de una suscripción (C16, HU-56 esc. 3, RN-17): cada cambio de estado o de plan con su
// fecha, lo anterior y lo nuevo y su origen (estudiante, tienda o sistema), del más nuevo al más
// antiguo; después sus pagos y los avisos de la tienda. Nunca muestra datos de tarjetas. Solo presenta.
import type { DetalleSuscripcion } from '../../tipos/suscripciones';
import {
  conteoDeAvisos,
  dia,
  enPesos,
  estudianteDe,
  fechaDeChile,
  lecturaDelCambio,
} from '../../utilidades/suscripciones';

function Pagos({ pagos }: Pick<DetalleSuscripcion, 'pagos'>) {
  if (pagos.length === 0) return <p className="linea-tiempo__nota">Sin pagos todavía.</p>;
  return (
    <ul className="linea-tiempo__lista">
      {pagos.map((pago) => (
        <li key={pago.id}>
          {fechaDeChile(pago.creadoEn)} · Pago {pago.estado.nombre.toLowerCase()}{' '}
          {enPesos(pago.montoClp)}
          <span className="tabla__secundario">
            Período del {dia(pago.periodoInicio)} al {dia(pago.periodoFin)}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Cada aviso con lo que hizo el sistema, y cuántos se procesaron y cuántos fallaron. */
function Avisos({ avisos, tienda }: Pick<DetalleSuscripcion, 'avisos' | 'tienda'>) {
  const { procesados, conError } = conteoDeAvisos(avisos);
  return (
    <>
      <ul className="linea-tiempo__lista">
        {avisos.map((aviso) => (
          <li key={aviso.id}>
            {fechaDeChile(aviso.recibidoEn)} · {aviso.tipo} · {aviso.resultado.nombre}
            {aviso.detalle && <span className="tabla__secundario">{aviso.detalle}</span>}
          </li>
        ))}
      </ul>
      <p className="linea-tiempo__nota">
        Avisos de {tienda.nombre}: {procesados} procesados, {conError} con error.
      </p>
    </>
  );
}

export function LineaDeTiempo({ detalle }: { detalle: DetalleSuscripcion }) {
  return (
    <section
      className="panel panel--ancho linea-tiempo"
      aria-label="Línea de tiempo de la suscripción"
    >
      <h2>{estudianteDe(detalle.correo)} · línea de tiempo</h2>
      <ol className="linea-tiempo__cambios">
        {detalle.historial.map((cambio) => {
          const { titulo, detalle: explicacion } = lecturaDelCambio(cambio);
          return (
            <li key={cambio.id}>
              <strong>
                {fechaDeChile(cambio.fecha)} · {titulo}
              </strong>
              <span className="tabla__secundario">{explicacion}</span>
            </li>
          );
        })}
      </ol>
      {detalle.historial.length === 0 && (
        <p className="linea-tiempo__nota">Sin cambios registrados.</p>
      )}
      <h3>Pagos</h3>
      <Pagos pagos={detalle.pagos} />
      <h3>Avisos de la tienda</h3>
      <Avisos avisos={detalle.avisos} tienda={detalle.tienda} />
    </section>
  );
}
