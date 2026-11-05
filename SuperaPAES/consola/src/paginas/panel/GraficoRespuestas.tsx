// Respuestas por día de C01: una barra por cada día del período, con su cifra al pasar el cursor. La lista de
// barras también la leen los lectores de pantalla, día por día.
import type { RespuestasDelDia } from '../../tipos/panel';
import { alturaDeBarra, diaCorto, textoDeBarra, totalDeRespuestas } from '../../utilidades/panel';

export function GraficoRespuestas({ dias }: { dias: readonly RespuestasDelDia[] }) {
  const primero = dias[0];
  const ultimo = dias.at(-1);
  return (
    <section className="panel panel--ancho" aria-label="Respuestas por día">
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
    </section>
  );
}
