// Texto de una pregunta con sus fórmulas e imágenes, como lo dibuja la app (HU-12.4, HU-34.2): el
// texto pasa por React, que lo escapa; solo el HTML que genera KaTeX se inserta tal cual.
import 'katex/dist/katex.min.css';
import { type ReactNode, useState } from 'react';
import { direccionDeImagen } from '../../api/cliente';
import {
  type BloquePregunta,
  bloquesDePregunta,
  type TrozoPregunta,
} from '../../utilidades/formato-pregunta';
import { dibujarFormula } from '../../utilidades/formula';

/** Una fórmula LaTeX. Si KaTeX no la puede leer, se muestra tal como se escribió, como en la app. */
function Formula({ tex, enBloque = false }: { tex: string; enBloque?: boolean }) {
  const dibujada = dibujarFormula(tex, enBloque);
  if ('error' in dibujada) {
    const marca = enBloque ? '$$' : '$';
    return <span className="formula formula--error">{`${marca}${tex}${marca}`}</span>;
  }
  return (
    <span
      className={enBloque ? 'formula formula--bloque' : 'formula'}
      // HTML generado por KaTeX, sin enlaces ni HTML (utilidades/formula.ts), no el texto escrito.
      dangerouslySetInnerHTML={{ __html: dibujada.html }}
    />
  );
}

/** Imagen de una pregunta o de un texto de lectura; si no carga, dice cuál era, como en la app. */
export function Imagen({ url, alternativo }: { url: string; alternativo: string }) {
  // Se guarda la dirección que falló: si se corrige mientras se escribe, se vuelve a intentar.
  const [fallida, setFallida] = useState<string | null>(null);
  if (fallida === url) {
    return (
      <p className="telefono__nota">
        No se pudo cargar la imagen{alternativo ? `: ${alternativo}` : ''}.
      </p>
    );
  }
  return (
    <img
      className="formato__imagen"
      src={direccionDeImagen(url)}
      alt={alternativo}
      loading="lazy"
      onError={() => setFallida(url)}
    />
  );
}

function Trozo({ trozo }: { trozo: TrozoPregunta }) {
  if (trozo.tipo === 'formula') return <Formula tex={trozo.tex} />;
  let contenido: ReactNode = trozo.texto;
  if (trozo.cursiva) contenido = <em>{contenido}</em>;
  if (trozo.negrita) contenido = <strong>{contenido}</strong>;
  return contenido;
}

function Bloque({ bloque }: { bloque: BloquePregunta }) {
  switch (bloque.tipo) {
    case 'formula':
      return <Formula tex={bloque.tex} enBloque />;
    case 'imagen':
      return <Imagen url={bloque.url} alternativo={bloque.alternativo} />;
    default:
      return (
        <p className="formato__parrafo">
          {bloque.trozos.map((trozo, i) => (
            <Trozo key={i} trozo={trozo} />
          ))}
        </p>
      );
  }
}

/** El enunciado, una alternativa, la explicación o el texto de lectura, en bloques. */
export function TextoConFormulas({ texto }: { texto: string }) {
  return (
    <div className="formato">
      {bloquesDePregunta(texto).map((bloque, i) => (
        <Bloque key={i} bloque={bloque} />
      ))}
    </div>
  );
}
