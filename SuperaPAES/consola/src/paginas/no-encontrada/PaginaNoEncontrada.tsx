// Página para rutas que no existen en la consola.
import { Link } from 'react-router';

export function PaginaNoEncontrada() {
  return (
    <section className="pagina">
      <h1>Página no encontrada</h1>
      <p>
        La dirección no corresponde a ninguna sección. <Link to="/">Volver al inicio</Link>.
      </p>
    </section>
  );
}
