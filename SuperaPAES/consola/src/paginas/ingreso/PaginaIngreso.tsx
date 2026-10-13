// Ingreso del personal interno. Se muestra fuera del diseño general, sin menú.
import { EnConstruccion } from '../../componentes/EnConstruccion';

export function PaginaIngreso() {
  return (
    <main className="ingreso">
      <EnConstruccion titulo="Ingreso">
        <p>Aquí el equipo de Supera PAES iniciará sesión con su correo y contraseña.</p>
      </EnConstruccion>
    </main>
  );
}
