import { useState, type SubmitEvent } from 'react';
import { EstadoVacio } from '../../componentes/EstadoVacio';
import { Paginacion } from '../../componentes/Paginacion';
import { SegunCarga } from '../../componentes/SegunCarga';
import { useSaldo } from '../../estado/saldo';
import type { ConsultaSaldo as Filtros, SaldoDocente } from '../../tipos/saldo';
import { enPesos, fechaDeChile } from '../../utilidades/suscripciones';
import { totalDePaginas } from '../../servicios/paginacion';
import './saldo.css';

function FiltroFechas({ filtrar }: { filtrar: (filtros: Filtros) => void }) {
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const invalido = Boolean(desde && hasta && desde > hasta);
  function enviar(evento: SubmitEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!invalido) filtrar({ ...(desde ? { desde } : {}), ...(hasta ? { hasta } : {}) });
  }
  return (
    <form className="saldo__filtros" onSubmit={enviar}>
      <label className="campo">
        Desde
        <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
      </label>
      <label className="campo">
        Hasta
        <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
      </label>
      <button className="boton" type="submit" disabled={invalido}>
        Filtrar
      </button>
      <button
        className="boton"
        type="button"
        onClick={() => {
          setDesde('');
          setHasta('');
          filtrar({});
        }}
      >
        Limpiar filtros
      </button>
      {invalido && <p role="alert">La fecha inicial no puede ser posterior a la final.</p>}
    </form>
  );
}

function ResumenSaldo({ saldo }: { saldo: SaldoDocente }) {
  const { resumen, capacidad } = saldo;
  const tarjetas = [
    ['Total acumulado', enPesos(resumen.totalClp)],
    ['Acumulado del mes', enPesos(resumen.mesClp)],
    ['Revisiones remuneradas', String(resumen.cantidad)],
  ];
  return (
    <>
      <dl className="tarjetas">
        {tarjetas.map(([titulo, valor]) => (
          <div className="tarjeta" key={titulo}>
            <dt>{titulo}</dt>
            <dd>{valor}</dd>
          </div>
        ))}
      </dl>
      <p className="campo__ayuda">
        Este mes: {resumen.cantidadMes} revisiones. Los acumulados incluyen todo el historial y el
        mes actual de Santiago, respectivamente.
      </p>
      <p>
        Hoy: {capacidad.completadas} de {capacidad.maxDiarias} revisiones. Pendientes:{' '}
        {capacidad.pendientes} de {capacidad.maxPendientes}.
      </p>
    </>
  );
}

function DetalleSaldo({
  saldo,
  cambiarPagina,
}: {
  saldo: SaldoDocente;
  cambiarPagina: (pagina: number) => void;
}) {
  return (
    <>
      {saldo.detalle.length === 0 ? (
        <EstadoVacio titulo="No hay revisiones remuneradas para mostrar." />
      ) : (
        <div className="tabla-desplazable">
          <table className="tabla">
            <caption>Detalle de remuneraciones</caption>
            <thead>
              <tr>
                {['Fecha', 'Pregunta', 'Tipo de revisión', 'Monto'].map((t) => (
                  <th scope="col" key={t}>
                    {t}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {saldo.detalle.map((fila) => (
                <tr key={fila.revisionId}>
                  <td>{fechaDeChile(fila.fecha)}</td>
                  <td>Pregunta {fila.preguntaId}</td>
                  <td>{fila.tipo === 'desempate' ? 'Desempate' : 'Revisión'}</td>
                  <td>{enPesos(fila.montoClp)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {saldo.paginacion.total > 0 && (
        <Paginacion
          paginacion={saldo.paginacion}
          totalPaginas={totalDePaginas(saldo.paginacion)}
          alCambiar={cambiarPagina}
        />
      )}
    </>
  );
}

export function ConsultaSaldo({ docenteId = null }: { docenteId?: number | null }) {
  const estado = useSaldo(docenteId);
  return (
    <div className="saldo">
      <FiltroFechas filtrar={estado.filtrar} />
      <SegunCarga carga={estado.carga} cargando="Cargando saldo...">
        {(saldo) => (
          <>
            {docenteId !== null && <h2>Saldo de {saldo.docente.nombre}</h2>}
            <ResumenSaldo saldo={saldo} />
            <DetalleSaldo saldo={saldo} cambiarPagina={estado.irAPagina} />
          </>
        )}
      </SegunCarga>
      {estado.carga.tipo === 'fallida' && (
        <button className="boton" type="button" onClick={estado.reintentar}>
          Reintentar
        </button>
      )}
    </div>
  );
}
