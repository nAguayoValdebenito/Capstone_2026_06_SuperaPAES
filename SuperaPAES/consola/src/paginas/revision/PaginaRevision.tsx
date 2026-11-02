// Sección Mis revisiones (D01, HU-22): bandeja y revisión con pauta del docente revisor. El encabezado
// se dibuja de inmediato; la bandeja y la pregunta se descargan al abrir la sección porque traen KaTeX
// para las fórmulas, como C03 (HU-12.4).
import { lazy, Suspense } from 'react';

const RevisionDocentePagina = lazy(() =>
  import('./RevisionDocente').then((m) => ({ default: m.RevisionDocentePagina })),
);

export function PaginaRevision() {
  return (
    <section className="pagina pagina--ancha">
      <header className="pagina__encabezado">
        <div>
          <h1>Mis revisiones</h1>
          <p className="pagina__aviso">
            Preguntas de tus áreas asignadas a ti, la fecha límite más próxima primero.
          </p>
        </div>
      </header>
      <Suspense fallback={<p aria-live="polite">Cargando tus revisiones…</p>}>
        <RevisionDocentePagina />
      </Suspense>
    </section>
  );
}
