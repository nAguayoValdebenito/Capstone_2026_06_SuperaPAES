// Resumen de suscripciones (C16, HU-56 esc. 1): las tarjetas del mes y, al pie, las suscripciones por
// plan y estado y los pagos de cada mes (en modo de prueba). Solo presenta.
import type { ResumenSuscripciones } from '../../tipos/suscripciones';
import { enPesos, nombreDelMes } from '../../utilidades/suscripciones';

interface Propiedades {
  resumen: ResumenSuscripciones;
}

export function TarjetasDelMes({ resumen }: Propiedades) {
  const tarjetas = [
    ['Activas', String(resumen.activas)],
    ['En mora', String(resumen.enMora)],
    ['Altas del mes', String(resumen.altasDelMes)],
    ['Cancelaciones del mes', String(resumen.cancelacionesDelMes)],
    ['Ingresos del mes', enPesos(resumen.ingresosDelMes)],
  ];
  return (
    <dl className="tarjetas">
      {tarjetas.map(([titulo, valor]) => (
        <div className="tarjeta" key={titulo}>
          <dt>{titulo}</dt>
          <dd>{valor}</dd>
        </div>
      ))}
    </dl>
  );
}

function PorPlanYEstado({ resumen }: Propiedades) {
  return (
    <div className="tabla-desplazable">
      <table className="tabla">
        <caption>Suscripciones por plan y estado</caption>
        <thead>
          <tr>
            <th scope="col">Plan</th>
            <th scope="col">Estado</th>
            <th scope="col">Suscripciones</th>
          </tr>
        </thead>
        <tbody>
          {resumen.porPlanYEstado.map((fila) => (
            <tr key={`${fila.plan}:${fila.estado.codigo}`}>
              <td>{fila.plan}</td>
              <td>{fila.estado.nombre}</td>
              <td>{fila.suscripciones}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {resumen.porPlanYEstado.length === 0 && <p>Todavía no hay suscripciones.</p>}
    </div>
  );
}

function PagosPorMes({ resumen }: Propiedades) {
  return (
    <div className="tabla-desplazable">
      <table className="tabla">
        <caption>Pagos de cada mes</caption>
        <thead>
          <tr>
            <th scope="col">Mes</th>
            <th scope="col">Aprobados</th>
            <th scope="col">Rechazados</th>
            <th scope="col">Ingresos</th>
          </tr>
        </thead>
        <tbody>
          {resumen.meses.map((mes) => (
            <tr key={mes.mes}>
              <td>{nombreDelMes(mes.mes)}</td>
              <td>{mes.pagosAprobados}</td>
              <td>{mes.pagosRechazados}</td>
              <td>{enPesos(mes.ingresosClp)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {resumen.meses.length === 0 && <p>Todavía no hay pagos.</p>}
    </div>
  );
}

export function ResumenPorPlanYMes({ resumen }: Propiedades) {
  return (
    <div className="suscripciones__resumen">
      <PorPlanYEstado resumen={resumen} />
      <PagosPorMes resumen={resumen} />
    </div>
  );
}
