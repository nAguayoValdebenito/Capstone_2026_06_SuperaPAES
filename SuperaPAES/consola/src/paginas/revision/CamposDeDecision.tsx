// La decisión del docente, común a Mis revisiones (D01, CU-19 pasos 4 y 5) y Desempates (D02, CU-20):
// la dificultad y la decisión como botones segmentados, el motivo (obligatorio al observar o rechazar),
// el error general y el botón de guardar. La lógica está en src/estado/bandeja-docente.ts.
import { MensajeError } from '../../componentes/MensajeError';
import type { RevisionDocente } from '../../estado/revision-docente';
import type { PreguntaARevisar } from '../../tipos';
import { deLista, type OpcionSelector } from '../../utilidades/opciones';

/** Lo que usa la decisión del estado de la bandeja (igual en D01 y D02). */
export type FormularioDocente = Pick<
  RevisionDocente,
  'campos' | 'errores' | 'enviando' | 'elegirDificultad' | 'elegirDecision' | 'escribirMotivo'
>;

/** Un grupo de opciones con forma de botones segmentados (Sí/No, Fácil/Media/Difícil…). */
export function Segmentado({
  nombre,
  opciones,
  elegida,
  alElegir,
}: {
  nombre: string;
  opciones: readonly OpcionSelector[];
  elegida: string | null;
  alElegir: (valor: string) => void;
}) {
  return (
    <div className="segmentado">
      {opciones.map(({ valor, texto }) => (
        <label key={valor} className="segmentado__opcion">
          <input
            type="radio"
            name={nombre}
            value={valor}
            checked={elegida === valor}
            onChange={() => alElegir(valor)}
          />
          <span>{texto}</span>
        </label>
      ))}
    </div>
  );
}

/** Un grupo segmentado con su leyenda y su error (la dificultad o la decisión). */
function CampoSegmentado({
  leyenda,
  error,
  ...segmentado
}: Parameters<typeof Segmentado>[0] & { leyenda: string; error: string | undefined }) {
  return (
    <fieldset className="campo">
      <legend>{leyenda}</legend>
      <Segmentado {...segmentado} />
      <MensajeError id={`error-${segmentado.nombre}`} texto={error} />
    </fieldset>
  );
}

/** El motivo (obligatorio al observar o rechazar, CU-19 5.a), el error general y el botón. */
function Motivo({
  revision,
  ayuda,
  boton,
}: {
  revision: FormularioDocente;
  ayuda: string;
  boton: string;
}) {
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
        <p className="campo__ayuda">{ayuda}</p>
        <button type="submit" className="boton boton--primario" disabled={revision.enviando}>
          {revision.enviando ? 'Guardando…' : boton}
        </button>
      </div>
    </>
  );
}

/** La dificultad, la decisión y el motivo en su panel, con los textos de cada sección. */
export function CamposDeDecision({
  pregunta,
  revision,
  textos,
}: {
  pregunta: Pick<PreguntaARevisar, 'dificultades' | 'decisiones'>;
  revision: FormularioDocente;
  textos: { dificultad: string; ayuda: string; boton: string };
}) {
  const { campos, errores } = revision;
  return (
    <section className="panel panel--ancho">
      <div className="decision">
        <CampoSegmentado
          leyenda={textos.dificultad}
          nombre="dificultad"
          opciones={deLista(pregunta.dificultades)}
          elegida={campos.dificultad}
          alElegir={revision.elegirDificultad}
          error={errores.dificultad}
        />
        <CampoSegmentado
          leyenda="Decisión"
          nombre="decision"
          opciones={deLista(pregunta.decisiones)}
          elegida={campos.decision}
          alElegir={revision.elegirDecision}
          error={errores.decision}
        />
      </div>
      <Motivo revision={revision} ayuda={textos.ayuda} boton={textos.boton} />
    </section>
  );
}
