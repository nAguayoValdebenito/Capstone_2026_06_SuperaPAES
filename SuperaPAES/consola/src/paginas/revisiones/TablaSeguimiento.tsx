// La tabla de C06: una fila por pregunta, con sus revisores, el desempate, la fecha límite y su estado.
import { Link } from 'react-router';
import type { DocenteSeguido, PreguntaSeguida } from '../../tipos/seguimiento';
import { codigoDePregunta, fechaLimite } from '../../utilidades/revision';
import { etiquetaDeDocente } from '../../utilidades/seguimiento';

const COLUMNAS = [
  'Pregunta',
  'Prueba · Contenido',
  'Revisor 1',
  'Revisor 2',
  'Desempate',
  'Fecha límite',
  'Estado',
];

function Docente({ docente, vencida }: { docente: DocenteSeguido | undefined; vencida: boolean }) {
  if (!docente) return <>—</>;
  const { texto, tono } = etiquetaDeDocente(docente, vencida);
  return (
    <>
      <span className="revisiones__correo">{docente.correo}</span>
      <span className={`etiqueta etiqueta--${tono}`}>{texto}</span>
    </>
  );
}

function Fila({ pregunta }: { pregunta: PreguntaSeguida }) {
  const [primero, segundo] = pregunta.revisores;
  const vencida = pregunta.venceEn !== null && new Date(pregunta.venceEn) < new Date();
  return (
    <tr>
      <th scope="row">
        <Link to={`/banco/${String(pregunta.id)}`}>{codigoDePregunta(pregunta.id)}</Link>
      </th>
      <td>
        {pregunta.prueba} · {pregunta.contenido}
      </td>
      <td>
        <Docente docente={primero} vencida={vencida} />
      </td>
      <td>
        <Docente docente={segundo} vencida={vencida} />
      </td>
      <td>
        <Docente docente={pregunta.desempate ?? undefined} vencida={vencida} />
      </td>
      <td>{pregunta.venceEn ? fechaLimite(pregunta.venceEn) : '—'}</td>
      <td className="revisiones__estado">
        <span className={`etiqueta etiqueta--${pregunta.estado.codigo}`}>
          {pregunta.estado.nombre}
        </span>
        {pregunta.posibleConfusa && (
          <span className="etiqueta etiqueta--confusa">Posiblemente confusa</span>
        )}
      </td>
    </tr>
  );
}

export function TablaSeguimiento({ preguntas }: { preguntas: readonly PreguntaSeguida[] }) {
  if (preguntas.length === 0) return <p>No hay preguntas en este grupo.</p>;
  return (
    <div className="tabla-desplazable">
      <table className="tabla revisiones__tabla">
        <thead>
          <tr>
            {COLUMNAS.map((columna) => (
              <th key={columna} scope="col">
                {columna}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {preguntas.map((pregunta) => (
            <Fila key={pregunta.id} pregunta={pregunta} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
