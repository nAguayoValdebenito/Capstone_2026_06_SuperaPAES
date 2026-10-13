// Diseño general de la consola: menú lateral y área de contenido.
import { Outlet } from 'react-router';
import { MenuLateral } from './MenuLateral';

export function DisenoGeneral() {
  return (
    <div className="diseno">
      <MenuLateral />
      <main className="contenido">
        <Outlet />
      </main>
    </div>
  );
}
