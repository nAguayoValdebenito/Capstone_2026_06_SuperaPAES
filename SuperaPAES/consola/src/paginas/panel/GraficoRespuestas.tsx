// Respuestas por día de C01: una barra por cada día del período, con su cifra al pasar el cursor. La lista de
// barras también la leen los lectores de pantalla, día por día, y los mismos datos se pueden ver como tabla.
import { useId } from 'react';
import { EstadoVacio } from '../../componentes/EstadoVacio';
import { useVerDatosComoTabla } from '../../estado/ver-datos-grafico';
import type { RespuestasDelDia } from '../../tipos/panel';
import { alturaDeBarra, diaCorto, textoDeBarra, totalDeRespuestas } from '../../utilidades/panel';

function TablaDeDias({
  id,
  dias,
  oculta,
}: {
  id: string;
  dias: readonly RespuestasDelDia[];
  oculta: boolean;
}) {
  return (
    <div id={id} className="tabla-desplazable panel-inicio__datos" hidden={oculta}>
      <table className="tabla">
        <thead>
          <tr>
            <th scope="col">Día</th>
            <th scope="col" className="tabla__numero">
              Respuestas
            </th>
          </tr>
        </thead>
        <tbody>
          {dias.map((dia) => (
            <tr key={dia.dia}>
              <td>{diaCorto(dia.dia)}</td>
              <td className="tabla__numero">{dia.total}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function GraficoRespuestas({ dias }: { dias: readonly RespuestasDelDia[] }) {
  const primero = dias[0];
  const ultimo = dias.at(-1);
  const idTabla = useId();
  const { abierta, alternar } = useVerDatosComoTabla();
  // Sin respuestas no hay nada que graficar: un aviso corto en lugar de un recuadro vacío.
  if (totalDeRespuestas(dias) === 0) {
    return (
      <section className="panel-inicio__grafico" aria-label="Respuestas por día">
        <h2>Respuestas por día</h2>
        <EstadoVacio titulo="Aún no hay respuestas en este período" />
      </section>
    );
  }
  return (
    <section className="panel-inicio__grafico" aria-label="Respuestas por día">
      <h2>Respuestas por día</h2>
      <p className="panel-inicio__valor">{totalDeRespuestas(dias)}</p>
      <ol className="panel-inicio__barras">
        {dias.map((dia) => (
          <li key={dia.dia} title={textoDeBarra(dia)} aria-label={textoDeBarra(dia)}>
            <span style={{ height: `${String(alturaDeBarra(dia.total, dias))}%` }} />
          </li>
        ))}
      </ol>
      {primero && ultimo && (
        <p className="panel-inicio__eje" aria-hidden="true">
          <span>{diaCorto(primero.dia)}</span>
          <span>{diaCorto(ultimo.dia)}</span>
        </p>
      )}
      <button
        type="button"
        className="boton-texto panel-inicio__ver-datos"
        aria-expanded={abierta}
        aria-controls={idTabla}
        onClick={alternar}
      >
        Ver los datos como tabla
      </button>
      <TablaDeDias id={idTabla} dias={dias} oculta={!abierta} />
    </section>
  );
}
