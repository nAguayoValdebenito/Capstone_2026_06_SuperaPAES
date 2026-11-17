// Sección Clasificar dificultad (D03, HU-25.2): las preguntas importadas del banco existente que el
// docente tiene asignadas, una por vista, y su dificultad con un clic. El encabezado se dibuja de
// inmediato; la pregunta se descarga al abrir la sección porque trae KaTeX para las fórmulas, como D01.
import { lazy, Suspense } from 'react';

const ClasificacionDocente = lazy(() =>
  import('./ClasificacionDocente').then((m) => ({ default: m.ClasificacionDocente })),
);

export function PaginaClasificarDificultad() {
  return (
    <section className="pagina pagina--ancha">
      <header className="pagina__encabezado">
        <div>
          <h1>Clasificar dificultad</h1>
          <p className="pagina__aviso">
            Preguntas importadas del banco existente asignadas a ti, la fecha límite más próxima
            primero.
          </p>
        </div>
      </header>
      <Suspense fallback={<p aria-live="polite">Cargando la pregunta…</p>}>
        <ClasificacionDocente />
      </Suspense>
    </section>
  );
}
