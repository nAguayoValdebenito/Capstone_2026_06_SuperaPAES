// D01 · Mis revisiones (HU-22.2 y HU-22.3, CU-19, RF-G07): a la izquierda la bandeja del docente con la
// fecha límite de cada revisión (la más próxima primero); a la derecha la pregunta que abrió, a ciegas,
// y el formulario de su revisión. Se carga al abrir la sección (trae KaTeX, como C03).
import { type RevisionDocente, useRevisionDocente } from '../../estado/revision-docente';
import type { RevisionPendiente } from '../../tipos';
import { FormularioRevision } from './FormularioRevision';
import { codigoDePregunta, fechaLimite } from '../../utilidades/revision';
import { PreguntaRevisada } from './PreguntaRevisada';

function Alerta({ texto }: { texto: string }) {
  return (
    <p className="aviso aviso--error" role="alert">
      {texto}
    </p>
  );
}

function Bandeja({
  revisiones,
  abierta,
  alElegir,
}: {
  revisiones: readonly RevisionPendiente[];
  abierta: number | null;
  alElegir: (id: number) => void;
}) {
  return (
    <nav className="bandeja" aria-label="Bandeja de revisiones">
      <h2>Bandeja ({revisiones.length})</h2>
      <ul>
        {revisiones.map((revision) => (
          <li key={revision.id}>
            <button
              type="button"
              className={
                revision.id === abierta ? 'bandeja__item bandeja__item--abierta' : 'bandeja__item'
              }
              aria-current={revision.id === abierta ? 'true' : undefined}
              onClick={() => alElegir(revision.id)}
            >
              <span className="bandeja__titulo">
                {codigoDePregunta(revision.preguntaId)} · {revision.prueba.codigo}
              </span>
              <span className="bandeja__fecha">{fechaLimite(revision.venceEn)}</span>
              <span className="tabla__secundario">{revision.contenido}</span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function Detalle({ revision }: { revision: RevisionDocente }) {
  const carga = revision.revision;
  if (carga.tipo === 'ninguna') return null;
  if (carga.tipo === 'cargando') return <p aria-live="polite">Cargando la pregunta…</p>;
  if (carga.tipo === 'fallida') return <Alerta texto={carga.mensaje} />;
  return (
    <div className="revision-detalle">
      <PreguntaRevisada pregunta={carga.pregunta} />
      <FormularioRevision pregunta={carga.pregunta} revision={revision} />
    </div>
  );
}

function Contenido({ revision }: { revision: RevisionDocente }) {
  const { bandeja } = revision;
  if (bandeja.tipo === 'cargando') return <p aria-live="polite">Cargando tu bandeja…</p>;
  if (bandeja.tipo === 'fallida') return <Alerta texto={bandeja.mensaje} />;
  if (bandeja.revisiones.length === 0) {
    return <p className="pagina__aviso">No tienes revisiones pendientes.</p>;
  }
  return (
    <div className="revision-docente">
      <Bandeja
        revisiones={bandeja.revisiones}
        abierta={revision.abierta}
        alElegir={revision.elegir}
      />
      <Detalle revision={revision} />
    </div>
  );
}

/** La bandeja y la revisión abierta con su estado, bajo el encabezado de la sección (exportada para las pruebas). */
export function ContenidoRevisionDocente({ revision }: { revision: RevisionDocente }) {
  return (
    <>
      {revision.aviso && (
        <p className="aviso aviso--exito" role="status">
          {revision.aviso}
        </p>
      )}
      <Contenido revision={revision} />
    </>
  );
}

export function RevisionDocentePagina() {
  return <ContenidoRevisionDocente revision={useRevisionDocente()} />;
}
