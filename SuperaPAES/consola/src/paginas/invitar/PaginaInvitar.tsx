// W01 y W02 · Página de invitación (DAS 7.2, RN-33): página pública de la consola que abre el link de
// invitación (/invitar/K7P2QX) en el teléfono o en el computador (HU-46 esc. 3, CU-11 paso 4). Muestra
// el código para copiarlo, los pasos y los botones de las tiendas, que durante la prueba cerrada llevan
// a su enlace de inscripción y a TestFlight. No abre la app ni deja el código escrito, y no llama a la
// API. Sigue el sistema de diseño de la app, como A05 (estilos en invitar.css).
import { useState } from 'react';
import { useParams } from 'react-router';
import { codigoDeInvitacion, enlacesTiendas } from './invitacion';
import './invitar.css';

const PASOS = [
  'Descarga la app.',
  'Crea tu cuenta.',
  'Escribe este código en «Código de invitación».',
];

function IconoTienda() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 4h16l-1.2 3H5.2L4 4Zm1.2 3h13.6v11.5a1.5 1.5 0 0 1-1.5 1.5H6.7a1.5 1.5 0 0 1-1.5-1.5V7Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M9 11a3 3 0 0 0 6 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

/** Botón oscuro de una tienda; sin enlace configurado, avisa que llega pronto. */
function BotonTienda({
  enlace,
  antes,
  tienda,
}: {
  enlace?: string;
  antes: string;
  tienda: string;
}) {
  const contenido = (
    <>
      <IconoTienda />
      <span>
        <small>{enlace ? antes : 'Pronto en'}</small>
        {tienda}
      </span>
    </>
  );
  return enlace ? (
    <a className="invitar__tienda" href={enlace} target="_blank" rel="noopener noreferrer">
      {contenido}
    </a>
  ) : (
    <span className="invitar__tienda invitar__tienda--pronto" aria-disabled="true">
      {contenido}
    </span>
  );
}

function TarjetaCodigo({ codigo }: { codigo: string }) {
  const [copiado, setCopiado] = useState<boolean | null>(null);
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(codigo);
      setCopiado(true);
    } catch {
      setCopiado(false);
    }
  };
  return (
    <section className="invitar__tarjeta invitar__codigo" aria-label="Código de invitación">
      <h2>Código de invitación</h2>
      <p className="invitar__valor">{codigo}</p>
      <button className="invitar__copiar" type="button" onClick={() => void copiar()}>
        Copiar código
      </button>
      <p className="invitar__estado" role="status">
        {copiado === true && 'Código copiado.'}
        {copiado === false && 'No se pudo copiar: escríbelo tal como aparece.'}
      </p>
    </section>
  );
}

export function PaginaInvitar() {
  const codigo = codigoDeInvitacion(useParams().codigo);
  const tiendas = enlacesTiendas(import.meta.env);

  return (
    <main className="invitar">
      <p className="invitar__marca">SUPERA PAES</p>
      <h1>Te invitaron a Supera PAES</h1>
      <p className="invitar__bajada">Practica la PAES con preguntas revisadas por docentes.</p>
      {codigo ? (
        <TarjetaCodigo codigo={codigo} />
      ) : (
        <p className="invitar__aviso" role="status">
          Este link de invitación no es válido. Pídele a quien te invitó que te lo envíe de nuevo, o
          crea tu cuenta sin código.
        </p>
      )}
      <ol className="invitar__tarjeta invitar__pasos">
        {PASOS.map((paso) => (
          <li key={paso}>{paso}</li>
        ))}
      </ol>
      <BotonTienda enlace={tiendas.googlePlay} antes="Disponible en" tienda="Google Play" />
      <BotonTienda enlace={tiendas.appStore} antes="Descargar en" tienda="App Store" />
      <p className="invitar__pie">
        Quien te invitó gana 5 preguntas extra cuando verificas tu correo.
      </p>
    </main>
  );
}
