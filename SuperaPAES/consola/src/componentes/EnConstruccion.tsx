// Página provisional de una sección que aún no se construye.
import type { ReactNode } from 'react';

export function EnConstruccion({ titulo, children }: { titulo: string; children?: ReactNode }) {
  return (
    <section className="pagina">
      <h1>{titulo}</h1>
      <p className="pagina__aviso">En construcción.</p>
      {children}
    </section>
  );
}
