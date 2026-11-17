// El formulario de la revisión docente (D01, HU-22.3, CU-19 pasos 3 a 5): cada punto de la pauta con
// «Sí» o «No» y la observación cuando no se cumple, la dificultad que asigna el docente, su decisión y
// el motivo al observar o rechazar (CamposDeDecision.tsx), todo en un acta con folio y firma. Los
// criterios van numerados, con cuántos faltan y los atajos S y N. La lógica está en src/estado.
import { MensajeError } from '../../componentes/MensajeError';
import { type Firma, TECLAS_SI_NO, pautaDelActa } from '../../estado/acta-docente';
import { contarNo, motivoSinAprobar } from '../../estado/formulario-revision';
import type { RevisionDocente } from '../../estado/revision-docente';
import type { CriterioPauta, PreguntaARevisar } from '../../tipos';
import type { OpcionSelector } from '../../utilidades/opciones';
import { textoPlano } from '../../utilidades/texto-plano';
import { FolioActa } from './Acta';
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
  alPresionarTecla,
}: {
  criterio: CriterioPauta;
  revision: RevisionDocente;
  alPresionarTecla: ReturnType<typeof pautaDelActa>['alPresionarTecla'];
}) {
  const respuesta = revision.campos.criterios[criterio.codigo];
  const elegida = respuesta?.cumple == null ? null : respuesta.cumple ? 'si' : 'no';
  const idError = `error-criterio-${criterio.codigo}`;
  return (
    <li className="pauta__punto">
      <fieldset
        className="pauta__pregunta"
        onKeyDown={(evento) => alPresionarTecla(criterio.codigo, evento)}
      >
        <legend>{criterio.descripcion}</legend>
        <Segmentado
          nombre={`criterio-${criterio.codigo}`}
          opciones={SI_NO}
          elegida={elegida}
          alElegir={(valor) => revision.responder(criterio.codigo, valor === 'si')}
          teclas={TECLAS_SI_NO}
        />
      </fieldset>
      {respuesta?.cumple === false && (
        <label className="campo pauta__observacion">
          Observación
          <input
            value={respuesta.observacion}
            maxLength={300}
            aria-invalid={revision.errores[`criterios.${criterio.codigo}`] ? true : undefined}
            aria-describedby={idError}
            onChange={(evento) => revision.observar(criterio.codigo, evento.target.value)}
          />
          <MensajeError id={idError} texto={revision.errores[`criterios.${criterio.codigo}`]} />
        </label>
      )}
    </li>
  );
}

/** La pauta con sus criterios numerados, cuántos faltan y la nota de los atajos. */
function Pauta({ pregunta, revision }: { pregunta: PreguntaARevisar; revision: RevisionDocente }) {
  const { avance, alPresionarTecla } = pautaDelActa(pregunta.pauta, revision);
  return (
    <section className="pauta" aria-describedby="error-criterios">
      {/* Barra fija: el enunciado, cuántos criterios faltan y cuántos «No» lleva, siempre a la vista. */}
      <div className="revision-acta__barra">
        <div className="revision-acta__cabeza">
          <h2>Pauta</h2>
          <p className="revision-acta__avance" aria-live="polite">
            {avance.texto}
          </p>
        </div>
        <p className="revision-acta__enunciado">{textoPlano(pregunta.enunciado)}</p>
        <p className="campo__ayuda revision-acta__limite" aria-live="polite">
          Se aprueba con hasta {pregunta.maximoNoParaAprobar} «No»; llevas{' '}
          {contarNo(revision.campos)}. Con más, solo se puede observar o rechazar.
        </p>
      </div>
      <p className="campo__ayuda revision-acta__atajos">
        Con el teclado: <kbd>S</kbd> marca Sí y <kbd>N</kbd> marca No en el criterio enfocado.
      </p>
      <ol className="pauta__puntos">
        {pregunta.pauta.map((criterio) => (
          <PuntoDeLaPauta
            key={criterio.codigo}
            criterio={criterio}
            revision={revision}
            alPresionarTecla={alPresionarTecla}
          />
        ))}
      </ol>
      <MensajeError id="error-criterios" texto={revision.errores.criterios} />
    </section>
  );
}

export function FormularioRevision({
  pregunta,
  revision,
  firma,
}: {
  pregunta: PreguntaARevisar;
  revision: RevisionDocente;
  firma: Firma;
}) {
  return (
    <form
      className="panel panel--ancho acta revision-acta revision-formulario"
      onSubmit={revision.entregar}
      noValidate
    >
      <FolioActa asignacion={pregunta} tipo="revisión" />
      <Pauta pregunta={pregunta} revision={revision} />
      <CamposDeDecision
        pregunta={pregunta}
        revision={revision}
        textos={TEXTOS}
        firma={firma}
        sinAprobar={motivoSinAprobar(revision.campos, pregunta.maximoNoParaAprobar)}
      />
    </form>
  );
}
