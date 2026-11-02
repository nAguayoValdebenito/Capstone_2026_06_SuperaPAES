// El formulario de la revisión docente (D01, HU-22.3, CU-19 pasos 3 a 5): cada punto de la pauta con
// «Sí» o «No» y la observación cuando no se cumple, la dificultad que asigna el docente, su decisión y
// el motivo al observar o rechazar. La lógica está en src/estado/revision-docente.ts.
import { MensajeError } from '../../componentes/MensajeError';
import type { RevisionDocente } from '../../estado/revision-docente';
import type { CriterioPauta, Opcion, PreguntaARevisar } from '../../tipos';

/** Un grupo de opciones con forma de botones segmentados (Sí/No, Fácil/Media/Difícil…). */
function Segmentado({
  nombre,
  opciones,
  elegida,
  alElegir,
}: {
  nombre: string;
  opciones: readonly { valor: string; etiqueta: string }[];
  elegida: string | null;
  alElegir: (valor: string) => void;
}) {
  return (
    <div className="segmentado">
      {opciones.map(({ valor, etiqueta }) => (
        <label key={valor} className="segmentado__opcion">
          <input
            type="radio"
            name={nombre}
            value={valor}
            checked={elegida === valor}
            onChange={() => alElegir(valor)}
          />
          <span>{etiqueta}</span>
        </label>
      ))}
    </div>
  );
}

const SI_NO = [
  { valor: 'si', etiqueta: 'Sí' },
  { valor: 'no', etiqueta: 'No' },
];

function PuntoDeLaPauta({
  criterio,
  revision,
}: {
  criterio: CriterioPauta;
  revision: RevisionDocente;
}) {
  const respuesta = revision.campos.criterios[criterio.codigo];
  const elegida = respuesta?.cumple == null ? null : respuesta.cumple ? 'si' : 'no';
  const idError = `error-criterio-${criterio.codigo}`;
  return (
    <li className="pauta__punto">
      <fieldset className="pauta__pregunta">
        <legend>{criterio.descripcion}</legend>
        <Segmentado
          nombre={`criterio-${criterio.codigo}`}
          opciones={SI_NO}
          elegida={elegida}
          alElegir={(valor) => revision.responder(criterio.codigo, valor === 'si')}
        />
      </fieldset>
      {respuesta?.cumple === false && (
        <label className="campo pauta__observacion">
          Observación
          <input
            value={respuesta.observacion}
            maxLength={300}
            aria-describedby={idError}
            onChange={(evento) => revision.observar(criterio.codigo, evento.target.value)}
          />
          <MensajeError id={idError} texto={revision.errores[`criterios.${criterio.codigo}`]} />
        </label>
      )}
    </li>
  );
}

const comoOpciones = (lista: readonly Opcion[]) =>
  lista.map(({ codigo, nombre }) => ({ valor: codigo, etiqueta: nombre }));

function Decision({
  pregunta,
  revision,
}: {
  pregunta: PreguntaARevisar;
  revision: RevisionDocente;
}) {
  const { campos, errores } = revision;
  return (
    <section className="panel panel--ancho">
      <div className="decision">
        <fieldset className="campo">
          <legend>Dificultad que asignas</legend>
          <Segmentado
            nombre="dificultad"
            opciones={comoOpciones(pregunta.dificultades)}
            elegida={campos.dificultad}
            alElegir={revision.elegirDificultad}
          />
          <MensajeError id="error-dificultad" texto={errores.dificultad} />
        </fieldset>
        <fieldset className="campo">
          <legend>Decisión</legend>
          <Segmentado
            nombre="decision"
            opciones={comoOpciones(pregunta.decisiones)}
            elegida={campos.decision}
            alElegir={revision.elegirDecision}
          />
          <MensajeError id="error-decision" texto={errores.decision} />
        </fieldset>
      </div>
      <Motivo revision={revision} />
    </section>
  );
}

/** El motivo (obligatorio al observar o rechazar, CU-19 5.a), el error general y «Guardar revisión». */
function Motivo({ revision }: { revision: RevisionDocente }) {
  const { campos, errores } = revision;
  return (
    <>
      <label className="campo">
        Motivo (obligatorio al observar o rechazar)
        <textarea
          rows={3}
          value={campos.comentario}
          aria-describedby="error-comentario"
          onChange={(evento) => revision.escribirMotivo(evento.target.value)}
        />
        <MensajeError id="error-comentario" texto={errores.comentario} />
      </label>
      {errores.general && (
        <p className="aviso aviso--error" role="alert">
          {errores.general}
        </p>
      )}
      <div className="decision__pie">
        <p className="campo__ayuda">
          No ves la dificultad sugerida ni la decisión del otro revisor.
        </p>
        <button type="submit" className="boton boton--primario" disabled={revision.enviando}>
          {revision.enviando ? 'Guardando…' : 'Guardar revisión'}
        </button>
      </div>
    </>
  );
}

export function FormularioRevision({
  pregunta,
  revision,
}: {
  pregunta: PreguntaARevisar;
  revision: RevisionDocente;
}) {
  return (
    <form className="revision-formulario" onSubmit={revision.entregar} noValidate>
      <section className="panel panel--ancho pauta" aria-describedby="error-criterios">
        <h2>Pauta</h2>
        <ol className="pauta__puntos">
          {pregunta.pauta.map((criterio) => (
            <PuntoDeLaPauta key={criterio.codigo} criterio={criterio} revision={revision} />
          ))}
        </ol>
        <MensajeError id="error-criterios" texto={revision.errores.criterios} />
      </section>
      <Decision pregunta={pregunta} revision={revision} />
    </form>
  );
}
