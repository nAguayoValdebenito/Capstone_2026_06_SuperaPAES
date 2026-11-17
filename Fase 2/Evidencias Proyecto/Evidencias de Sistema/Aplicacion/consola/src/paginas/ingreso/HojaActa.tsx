// Hoja de acta de las páginas públicas (ingreso, nueva contraseña, verificar correo, invitación y textos
// legales): una hoja centrada sobre el papel, con la línea de margen celeste, el logo con su nombre y el
// visto grande que se dibuja arriba. Estilos en hoja-acta.css.
import type { ReactNode } from 'react';
import { Logo } from '../../componentes/Icono';
import './hoja-acta.css';

/** El logo con el nombre de la marca (y, si lo hay, a quién sirve la página) y el visto del logo. */
function Cabeza({ subtitulo }: { subtitulo: string | undefined }) {
  return (
    <div className="hoja-acta__cabeza">
      <div className="hoja-acta__marca">
        <Logo tamano={40} />
        <div>
          <div className="hoja-acta__nombre">
            Supera<span>PAES</span>
          </div>
          {subtitulo && <div className="hoja-acta__subtitulo">{subtitulo}</div>}
        </div>
      </div>
      <svg
        className="hoja-acta__visto"
        width="72"
        height="40"
        viewBox="0 0 120 64"
        aria-hidden="true"
        focusable="false"
      >
        <path d="M6 38 L34 58 L112 6" />
      </svg>
    </div>
  );
}

export function HojaActa({
  clase,
  ancha = false,
  subtitulo,
  children,
}: {
  /** Clase propia de la página, que va en el `main` junto a la hoja. */
  clase: string;
  /** Hoja de lectura (textos legales), más ancha que la de un formulario. */
  ancha?: boolean;
  /** Bajo el nombre de la marca (por ejemplo, «Consola del equipo» en el ingreso). */
  subtitulo?: string;
  children: ReactNode;
}) {
  return (
    <div className={ancha ? 'hoja-acta hoja-acta--ancha' : 'hoja-acta'}>
      <main className={`hoja-acta__hoja acta ${clase}`}>
        <Cabeza subtitulo={subtitulo} />
        {children}
      </main>
    </div>
  );
}
