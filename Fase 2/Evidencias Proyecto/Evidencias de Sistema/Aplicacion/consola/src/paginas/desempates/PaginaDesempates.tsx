// Sección Desempates (D02, HU-23): las preguntas en que los dos revisores no coincidieron, con sus dos
// revisiones, para que el tercer docente decida. El encabezado se dibuja de inmediato; la bandeja y la
// pregunta se descargan al abrir la sección porque traen KaTeX para las fórmulas, como D01.
import { lazy, Suspense } from 'react';

const DesempateDocentePagina = lazy(() =>
  import('./DesempateDocente').then((m) => ({ default: m.DesempateDocentePagina })),
);

export function PaginaDesempates() {
  return (
    <section className="pagina pagina--ancha">
      <header className="pagina__encabezado">
        <div>
          <h1>Desempates</h1>
          <p className="pagina__aviso">
            Preguntas en las que los dos revisores no coincidieron. Tu decisión como tercer docente
            es la final.
          </p>
        </div>
      </header>
      <Suspense fallback={<p aria-live="polite">Cargando tus desempates…</p>}>
        <DesempateDocentePagina />
      </Suspense>
    </section>
  );
}
