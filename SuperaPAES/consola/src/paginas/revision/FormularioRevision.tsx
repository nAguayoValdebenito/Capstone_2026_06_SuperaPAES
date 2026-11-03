// El formulario de la revisión docente (D01, HU-22.3, CU-19 pasos 3 a 5): cada punto de la pauta con
// «Sí» o «No» y la observación cuando no se cumple, la dificultad que asigna el docente, su decisión y
// el motivo al observar o rechazar (CamposDeDecision.tsx). La lógica está en src/estado.
import { MensajeError } from '../../componentes/MensajeError';
import type { RevisionDocente } from '../../estado/revision-docente';
import type { CriterioPauta, PreguntaARevisar } from '../../tipos';
import type { OpcionSelector } from '../../utilidades/opciones';
import { CamposDeDecision, Segmentado } from './CamposDeDecision';

const SI_NO: OpcionSelector[] = [
  { valor: 'si', texto: 'Sí' },
  { valor: 'no', texto: 'No' },
];

const TEXTOS = {
  dificultad: 'Dificultad que asignas',
  ayuda: 'No ves la dificultad sugerida ni la decisión del otro revisor.',
  boton: 'Guardar revisión',
};

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
      <CamposDeDecision pregunta={pregunta} revision={revision} textos={TEXTOS} />
    </form>
  );
}
