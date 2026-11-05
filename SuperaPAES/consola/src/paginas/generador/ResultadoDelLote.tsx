// El resultado de un lote cerrado de C05: el texto de lectura y una fila por pregunta. La válida abre su
// borrador; la descartada no muestra su enunciado, porque el servidor no guarda el texto del modelo (HU-16.5).
import { Link } from 'react-router';
import type { ResultadoLote } from '../../tipos/generador';
import { filasDelResultado } from '../../utilidades/generador';
import { TextoConFormulas } from '../pregunta/TextoConFormulas';

const COLUMNAS = ['Propuesta', 'Habilidad', 'Dificultad sugerida', 'Resultado'];

function TextoDeLectura({ texto }: { texto: NonNullable<ResultadoLote['texto']> }) {
  return (
    <details className="generador__texto" open>
      <summary>{texto.titulo ? `Texto de lectura: ${texto.titulo}` : 'Texto de lectura'}</summary>
      {texto.contenido && <TextoConFormulas texto={texto.contenido} />}
    </details>
  );
}

export function ResultadoDelLote({ resultado }: { resultado: ResultadoLote }) {
  const filas = filasDelResultado(resultado);
  return (
    <>
      {resultado.texto && <TextoDeLectura texto={resultado.texto} />}
      {filas.length > 0 && (
        <div className="tabla-desplazable">
          <table className="tabla generador__resultado">
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
              {filas.map((fila) => (
                <tr key={fila.clave}>
                  <td>
                    {fila.enunciado === null ? (
                      fila.propuesta
                    ) : (
                      <div className="generador__enunciado">
                        <TextoConFormulas texto={fila.enunciado} />
                      </div>
                    )}
                  </td>
                  <td>{fila.habilidad}</td>
                  <td>{fila.dificultad}</td>
                  <td>
                    {fila.preguntaId === null ? (
                      fila.resultado
                    ) : (
                      <Link to={`/banco/${fila.preguntaId}`}>{fila.resultado}</Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
