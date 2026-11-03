// La bandeja del docente, común a Mis revisiones (D01, HU-22) y Desempates (D02, HU-23): a la izquierda
// sus asignaciones con la fecha límite (la más próxima primero); a la derecha la que abrió, que dibuja
// cada sección. Arriba, el aviso al entregar. La lógica está en src/estado/bandeja-docente.ts.
import type { ReactNode } from 'react';
import { Alerta } from '../../componentes/Alerta';
import type { CargaAsignacion, EstadoBandejaDocente } from '../../estado/bandeja-docente';
import type { RevisionPendiente } from '../../tipos';
import { codigoDePregunta, fechaLimite } from '../../utilidades/revision';

/** La bandeja con el estado de la sección, sus textos y cómo dibujar la asignación abierta. */
interface PropsBandeja<P extends RevisionPendiente> {
  estado: Pick<EstadoBandejaDocente<P>, 'bandeja' | 'abierta' | 'revision' | 'aviso' | 'elegir'>;
  /** El nombre de la bandeja y el aviso cuando está vacía. */
  textos: { bandeja: string; vacia: string };
  children: (pregunta: P) => ReactNode;
}

function Bandeja({
  nombre,
  revisiones,
  abierta,
  alElegir,
}: {
  nombre: string;
  revisiones: readonly RevisionPendiente[];
  abierta: number | null;
  alElegir: (id: number) => void;
}) {
  return (
    <nav className="bandeja" aria-label={nombre}>
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

function Detalle<P>({
  carga,
  children,
}: {
  carga: CargaAsignacion<P>;
  children: (pregunta: P) => ReactNode;
}) {
  if (carga.tipo === 'ninguna') return null;
  if (carga.tipo === 'cargando') return <p aria-live="polite">Cargando la pregunta…</p>;
  if (carga.tipo === 'fallida') return <Alerta texto={carga.mensaje} />;
  return <div className="revision-detalle">{children(carga.pregunta)}</div>;
}

function Contenido<P extends RevisionPendiente>({ estado, textos, children }: PropsBandeja<P>) {
  const { bandeja } = estado;
  if (bandeja.tipo === 'cargando') return <p aria-live="polite">Cargando tu bandeja…</p>;
  if (bandeja.tipo === 'fallida') return <Alerta texto={bandeja.mensaje} />;
  if (bandeja.revisiones.length === 0) return <p className="pagina__aviso">{textos.vacia}</p>;
  return (
    <div className="revision-docente">
      <Bandeja
        nombre={textos.bandeja}
        revisiones={bandeja.revisiones}
        abierta={estado.abierta}
        alElegir={estado.elegir}
      />
      <Detalle carga={estado.revision}>{children}</Detalle>
    </div>
  );
}

/** La bandeja con la asignación abierta y el aviso al entregar, bajo el encabezado de la sección. */
export function BandejaDocente<P extends RevisionPendiente>({
  estado,
  textos,
  children,
}: PropsBandeja<P>) {
  return (
    <>
      {estado.aviso && (
        <p className="aviso aviso--exito" role="status">
          {estado.aviso}
        </p>
      )}
      <Contenido estado={estado} textos={textos}>
        {children}
      </Contenido>
    </>
  );
}
