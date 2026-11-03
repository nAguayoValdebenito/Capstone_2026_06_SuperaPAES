// Las dos revisiones de la ronda que ve el tercer docente (D02, HU-23, CU-20): de cada una, la decisión,
// la dificultad, el motivo y cada punto de la pauta con su observación, como «Revisión 1» y «Revisión 2»
// (sin decir quién la escribió). Si una dijo fácil y la otra difícil, avisa que la pregunta es
// posiblemente confusa (RN-12).
import type { DesempateAbierto, RevisionDelRevisor } from '../../tipos';

function RevisionDeLaRonda({ numero, revision }: { numero: number; revision: RevisionDelRevisor }) {
  return (
    <article className="revision-ronda" aria-label={`Revisión ${String(numero)}`}>
      <h3>Revisión {numero}</h3>
      <dl className="revision-ronda__resumen">
        <dt>Decisión</dt>
        <dd>{revision.decision.nombre}</dd>
        <dt>Dificultad</dt>
        <dd>{revision.dificultad.nombre}</dd>
        {revision.comentario && (
          <>
            <dt>Motivo</dt>
            <dd>{revision.comentario}</dd>
          </>
        )}
      </dl>
      <ul className="revision-ronda__pauta">
        {revision.criterios.map((criterio) => (
          <li
            key={criterio.codigo}
            className={
              criterio.cumple
                ? 'revision-ronda__punto'
                : 'revision-ronda__punto revision-ronda__punto--no'
            }
          >
            <span className="revision-ronda__marca">{criterio.cumple ? 'Sí' : 'No'}</span>
            <span>
              {criterio.descripcion}
              {criterio.observacion && (
                <span className="tabla__secundario">{criterio.observacion}</span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </article>
  );
}

export function RevisionesDeLaRonda({ desempate }: { desempate: DesempateAbierto }) {
  return (
    <section className="panel panel--ancho" aria-labelledby="titulo-revisiones">
      <h2 id="titulo-revisiones">Revisiones de la ronda</h2>
      {desempate.posibleAmbigua && (
        <p className="aviso aviso--advertencia">
          Posiblemente confusa: una revisión la consideró fácil y la otra difícil.
        </p>
      )}
      <div className="revisiones-ronda">
        {desempate.revisiones.map((revision, i) => (
          <RevisionDeLaRonda key={i} numero={i + 1} revision={revision} />
        ))}
      </div>
    </section>
  );
}
