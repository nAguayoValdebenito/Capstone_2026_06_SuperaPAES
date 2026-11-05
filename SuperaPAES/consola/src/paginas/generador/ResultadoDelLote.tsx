// El resultado de un lote cerrado de C05: una fila por pregunta. La válida abre su borrador; la descartada no
// muestra su enunciado, porque el servidor no guarda el texto del modelo (HU-16.5). El texto de lectura se ve
// en TextosDelLote.
import { Link } from 'react-router';
import type { ResultadoLote } from '../../tipos/generador';
import { filasDelResultado } from '../../utilidades/generador';
import { TextoConFormulas } from '../pregunta/TextoConFormulas';

const COLUMNAS = ['Propuesta', 'Habilidad', 'Dificultad sugerida', 'Resultado'];

export function ResultadoDelLote({ resultado }: { resultado: ResultadoLote }) {
  const filas = filasDelResultado(resultado);
  return (
    <>
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
