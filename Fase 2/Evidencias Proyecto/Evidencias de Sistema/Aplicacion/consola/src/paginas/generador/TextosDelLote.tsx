// C05 · HU-18.3, CP-14: lectura completa y sus preguntas en orden, sin modificar el lote.
import { Link } from 'react-router';
import { SegunCarga } from '../../componentes/SegunCarga';
import { useTextosGenerados } from '../../estado/textos-generados';
import type { LecturaDelLote } from '../../servicios/textos-generados';
import type { PreguntaParaEditar, PruebaTemario } from '../../tipos';
import { Imagen, TextoConFormulas } from '../pregunta/TextoConFormulas';

function PreguntaGenerada({
  pregunta,
  habilidades,
}: {
  pregunta: PreguntaParaEditar;
  habilidades: PruebaTemario['habilidades'];
}) {
  const habilidad = habilidades.find(({ id }) => id === pregunta.habilidadId)?.nombre;
  return (
    <article className="generador__pregunta">
      <h4>
        Pregunta {pregunta.ordenEnTexto} · {habilidad}
      </h4>
      <p>{pregunta.estado.nombre}</p>
      <TextoConFormulas texto={pregunta.enunciado} />
      <ol className="generador__alternativas">
        {pregunta.alternativas.map((alternativa) => (
          <li key={alternativa.letra}>
            <strong>
              {alternativa.letra}
              {alternativa.esCorrecta ? ' · Correcta' : ''}
            </strong>
            <TextoConFormulas texto={alternativa.texto} />
          </li>
        ))}
      </ol>
      <details>
        <summary>Explicación de la respuesta</summary>
        <TextoConFormulas texto={pregunta.explicacion} />
      </details>
      <Link to={`/banco/${String(pregunta.id)}`}>Abrir pregunta en el banco</Link>
    </article>
  );
}

function Lectura({ lectura, pruebas }: { lectura: LecturaDelLote; pruebas: PruebaTemario[] }) {
  const { texto, preguntas } = lectura;
  const prueba = pruebas.find(({ id }) => id === preguntas[0]?.pruebaId);
  return (
    <article className="generador__lectura">
      <h3>{texto.titulo ?? 'Texto de lectura'}</h3>
      {texto.contenido && <TextoConFormulas texto={texto.contenido} />}
      {texto.imagenUrl && (
        <Imagen url={texto.imagenUrl} alternativo={texto.titulo ?? 'Imagen del texto de lectura'} />
      )}
      {preguntas.map((pregunta) => (
        <PreguntaGenerada
          key={pregunta.id}
          pregunta={pregunta}
          habilidades={prueba?.habilidades ?? []}
        />
      ))}
    </article>
  );
}

export function TextosDelLote({ loteId, pruebas }: { loteId: string; pruebas: PruebaTemario[] }) {
  const { carga, reintentar } = useTextosGenerados(loteId);
  return (
    <section
      className="panel panel--ancho generador__lecturas"
      aria-label="Texto y preguntas del lote"
    >
      <h2>Texto y preguntas del lote {loteId}</h2>
      <SegunCarga carga={carga} cargando="Cargando el texto y sus preguntas…">
        {(lecturas) =>
          lecturas.length > 0 ? (
            lecturas.map((lectura) => (
              <Lectura key={lectura.texto.id} lectura={lectura} pruebas={pruebas} />
            ))
          ) : (
            <p>No hay preguntas con texto guardadas en este lote.</p>
          )
        }
      </SegunCarga>
      {carga.tipo === 'fallida' && (
        <button type="button" className="boton" onClick={reintentar}>
          Reintentar
        </button>
      )}
    </section>
  );
}
