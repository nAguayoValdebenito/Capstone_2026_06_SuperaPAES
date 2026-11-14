// Página para rutas que no existen en la consola: el encabezado de página y un estado vacío con la salida.
import { Link } from 'react-router';
import { EstadoVacio } from '../../componentes/EstadoVacio';

export function PaginaNoEncontrada() {
  return (
    <section className="pagina">
      <header className="pagina__encabezado">
        <div>
          <h1>Página no encontrada</h1>
        </div>
      </header>
      <EstadoVacio
        titulo="La dirección no corresponde a ninguna sección."
        accion={
          <Link className="boton" to="/">
            Volver al inicio
          </Link>
        }
      />
    </section>
  );
}
