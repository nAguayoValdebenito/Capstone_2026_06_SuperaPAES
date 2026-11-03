// /terminos y /privacidad (HU-34.4, RN-30): páginas públicas de la consola con la versión vigente de los
// términos y condiciones y de la política de privacidad, cuya dirección piden las fichas de Google Play y
// de la App Store. No piden sesión ni muestran el menú; llevan el logo (DAS 7.5). El texto sale de la base
// (contenido.documento_legal), el mismo que acepta el estudiante en la app (A02 y A02b).
import { useEffect } from 'react';
import { Link } from 'react-router';
import { SegunCarga } from '../../componentes/SegunCarga';
import { useCarga } from '../../estado/carga';
import { documentoDe, obtenerDocumentosVigentes } from '../../servicios/documentos-legales';
import type { DocumentoLegal, TipoDocumentoPublico } from '../../tipos/documentos-legales';
import { type BloqueTexto, bloquesDe } from '../../utilidades/markdown';
import './legales.css';

const NOMBRE: Record<TipoDocumentoPublico, string> = {
  terminos: 'Términos y condiciones',
  privacidad: 'Política de privacidad',
};

const OTRO: Record<TipoDocumentoPublico, TipoDocumentoPublico> = {
  terminos: 'privacidad',
  privacidad: 'terminos',
};

/** El error para quien lee la página, que no es del equipo: sin el detalle técnico. */
const SIN_CARGAR = 'No pudimos cargar el documento. Intenta de nuevo en unos minutos.';

function Bloque({ bloque }: { bloque: BloqueTexto }) {
  switch (bloque.tipo) {
    case 'titulo':
      return <h1>{bloque.texto}</h1>;
    case 'subtitulo':
      return <h2>{bloque.texto}</h2>;
    case 'lista':
      return (
        <ul>
          {bloque.items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      );
    default:
      return <p>{bloque.texto}</p>;
  }
}

/** El texto del documento, bloque por bloque. */
export function TextoLegal({ documento }: { documento: DocumentoLegal }) {
  return (
    <article className="legal__texto">
      {bloquesDe(documento.texto).map((bloque, i) => (
        <Bloque key={i} bloque={bloque} />
      ))}
    </article>
  );
}

export function PaginaDocumentoLegal({ tipo }: { tipo: TipoDocumentoPublico }) {
  const carga = useCarga(obtenerDocumentosVigentes);
  const otro = OTRO[tipo];
  // Las dos rutas usan la misma página: al pasar de una a otra se vuelve al inicio del texto.
  useEffect(() => window.scrollTo(0, 0), [tipo]);
  return (
    <main className="legal">
      <title>{`${NOMBRE[tipo]} · Supera PAES`}</title>
      <img
        className="legal__logo"
        src="/logo_supera_paes.png"
        alt="Supera PAES"
        width={991}
        height={823}
      />
      <SegunCarga carga={carga} cargando="Cargando el documento…" fallida={SIN_CARGAR}>
        {(documentos) => {
          const documento = documentoDe(documentos, tipo);
          return documento ? (
            <TextoLegal documento={documento} />
          ) : (
            <p className="aviso aviso--info" role="status">
              El documento no está publicado todavía.
            </p>
          );
        }}
      </SegunCarga>
      <p className="legal__pie">
        Lee también: <Link to={`/${otro}`}>{NOMBRE[otro]}</Link>. Consultas: superapaes@gmail.com.
      </p>
    </main>
  );
}
