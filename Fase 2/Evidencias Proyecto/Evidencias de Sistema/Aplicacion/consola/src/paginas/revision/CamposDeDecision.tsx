// La decisión del docente, común a Mis revisiones (D01, CU-19 pasos 4 y 5) y Desempates (D02, CU-20):
// la dificultad y la decisión como botones segmentados, el motivo (obligatorio al observar o rechazar),
// el error general y la firma del acta (quién decide y la fecha) junto al botón de guardar. La lógica
// está en src/estado/bandeja-docente.ts y src/estado/acta-docente.ts.
import { Alerta } from '../../componentes/Alerta';
import { MensajeError } from '../../componentes/MensajeError';
import type { Firma } from '../../estado/acta-docente';
import type { EstadoBandejaDocente } from '../../estado/bandeja-docente';
import type { PreguntaARevisar, RevisionPendiente } from '../../tipos';
import { deLista, type OpcionSelector } from '../../utilidades/opciones';

/** Lo que usa la decisión del estado de la bandeja (igual en D01 y D02). */
export type FormularioDocente = Pick<
  EstadoBandejaDocente<RevisionPendiente>,
  'campos' | 'errores' | 'enviando' | 'elegirDificultad' | 'elegirDecision' | 'escribirMotivo'
>;

/** Un grupo de opciones con forma de botones segmentados (Sí/No, Fácil/Media/Difícil…). */
export function Segmentado({
  nombre,
  opciones,
  elegida,
  alElegir,
  teclas,
  deshabilitadas = [],
}: {
  nombre: string;
  opciones: readonly OpcionSelector[];
  elegida: string | null;
  alElegir: (valor: string) => void;
  /** El atajo de cada opción por su valor (aria-keyshortcuts), si lo tiene. */
  teclas?: Readonly<Record<string, string>>;
  /** Valores que no se pueden elegir ahora (se ven apagados y no reciben el foco). */
  deshabilitadas?: readonly string[];
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
            disabled={deshabilitadas.includes(valor)}
            aria-keyshortcuts={teclas?.[valor]}
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

/** El pie del acta: quién firma y la fecha, junto al botón de guardar. */
function FirmaConBoton({
  firma,
  boton,
  enviando,
}: {
  firma: Firma;
  boton: string;
  enviando: boolean;
}) {
  return (
    <div className="firma">
      <p className="firma__quien">
        Firma <b>{firma.quien}</b>
        {firma.fecha && ` · ${firma.fecha}`}
      </p>
      <button type="submit" className="boton boton--primario" disabled={enviando}>
        {enviando ? 'Guardando…' : boton}
      </button>
    </div>
  );
}

/** El motivo (obligatorio al observar o rechazar, CU-19 5.a), el error general y la firma. */
function Motivo({
  revision,
  ayuda,
  boton,
  firma,
}: {
  revision: FormularioDocente;
  ayuda: string;
  boton: string;
  firma: Firma;
}) {
  const { campos, errores } = revision;
  return (
    <>
      <label className="campo">
        Motivo (obligatorio al observar o rechazar)
        <textarea
          rows={3}
          value={campos.comentario}
          aria-invalid={errores.comentario ? true : undefined}
          aria-describedby="error-comentario"
          onChange={(evento) => revision.escribirMotivo(evento.target.value)}
        />
        <MensajeError id="error-comentario" texto={errores.comentario} />
      </label>
      {errores.general && <Alerta texto={errores.general} />}
      <p className="campo__ayuda">{ayuda}</p>
      <FirmaConBoton firma={firma} boton={boton} enviando={revision.enviando} />
    </>
  );
}

/** La dificultad, la decisión, el motivo y la firma dentro del acta, con los textos de cada sección. */
export function CamposDeDecision({
  pregunta,
  revision,
  textos,
  firma,
  sinAprobar,
}: {
  pregunta: Pick<PreguntaARevisar, 'dificultades' | 'decisiones'>;
  revision: FormularioDocente;
  textos: { dificultad: string; ayuda: string; boton: string };
  firma: Firma;
  /** Por qué no se puede aprobar (D01, con demasiados «No»); sin esto se puede elegir cualquier decisión. */
  sinAprobar?: string | null;
}) {
  const { campos, errores } = revision;
  return (
    <div className="revision-acta__decision">
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
          deshabilitadas={sinAprobar ? ['aprobar'] : []}
        />
      </div>
      {sinAprobar && (
        <p className="aviso aviso--advertencia" role="status">
          <span>
            <strong>No se puede aprobar.</strong> {sinAprobar}
          </span>
        </p>
      )}
      <Motivo revision={revision} ayuda={textos.ayuda} boton={textos.boton} firma={firma} />
    </div>
  );
}
