// La pregunta que revisa el docente (D01, HU-22): tal como se envió a revisión, con su ubicación en el
// temario, el texto de lectura si tiene, las alternativas con la correcta marcada y la explicación. Las
// fórmulas se dibujan como en la app (TextoConFormulas, HU-12.4). A ciegas: no hay dificultad sugerida.
import type { PreguntaARevisar } from '../../tipos';
import { codigoDePregunta, fechaLimite } from '../../utilidades/revision';
import { TextoConFormulas } from '../pregunta/TextoConFormulas';

export function PreguntaRevisada({ pregunta }: { pregunta: PreguntaARevisar }) {
  const ubicacion = [pregunta.prueba.nombre, pregunta.eje, pregunta.contenido, pregunta.habilidad];
  return (
    <article className="panel panel--ancho revision-pregunta">
      <header className="revision-pregunta__encabezado">
        <h2>
          {codigoDePregunta(pregunta.preguntaId)} · {ubicacion.join(' · ')}
        </h2>
        <span className="etiqueta etiqueta--plazo">Vence el {fechaLimite(pregunta.venceEn)}</span>
      </header>
      {pregunta.texto && (
        <section className="revision-pregunta__texto" aria-label="Texto de lectura">
          {pregunta.texto.titulo && <h3>{pregunta.texto.titulo}</h3>}
          <TextoConFormulas texto={pregunta.texto.contenido ?? ''} />
        </section>
      )}
      <TextoConFormulas texto={pregunta.enunciado} />
      <ul className="revision-alternativas">
        {pregunta.alternativas.map((alternativa) => (
          <li
            key={alternativa.id}
            className={
              alternativa.esCorrecta
                ? 'revision-alternativa revision-alternativa--correcta'
                : 'revision-alternativa'
            }
          >
            <span className="revision-alternativa__letra">{alternativa.letra}</span>
            <TextoConFormulas texto={alternativa.texto} />
            {alternativa.esCorrecta && (
              <span className="revision-alternativa__marca">Correcta</span>
            )}
          </li>
        ))}
      </ul>
      <div className="revision-pregunta__explicacion">
        <strong>Explicación:</strong>
        <TextoConFormulas texto={pregunta.explicacion} />
      </div>
    </article>
  );
}
