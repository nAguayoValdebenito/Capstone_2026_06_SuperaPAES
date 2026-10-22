// Ingreso del personal interno. Se muestra fuera del diseño general, sin menú, con el logo (DAS 7.5).
import { EnConstruccion } from '../../componentes/EnConstruccion';

export function PaginaIngreso() {
  return (
    <main className="ingreso">
      <img
        className="ingreso__logo"
        src="/logo_supera_paes.png"
        alt="Supera PAES"
        width={991}
        height={823}
      />
      <EnConstruccion titulo="Ingreso">
        <p>Aquí el equipo de Supera PAES iniciará sesión con su correo y contraseña.</p>
      </EnConstruccion>
    </main>
  );
}
