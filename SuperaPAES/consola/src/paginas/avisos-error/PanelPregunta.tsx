// Detalle de la pregunta elegida en C13: el acceso a C03, sus avisos con Resolver y Descartar (HU-50
// esc. 2) y la anulación (esc. 3), que solo se ofrece si la pregunta está publicada.
import type { Ref } from 'react';
import { Link } from 'react-router';
import { avisoPendiente, sePuedeAnular } from '../../estado/avisos-error';
import type { AvisoDeError, CierreAviso, PreguntaConAvisos } from '../../tipos/avisos-error';
import { fechaCorta } from './formato';

/** Quién y cuándo cerró el aviso, en una sola frase. */
function textoCerrado({ resueltoPor, resueltoEn }: AvisoDeError): string {
  const quien = resueltoPor ? ` por ${resueltoPor}` : '';
  const cuando = resueltoEn ? ` el ${fechaCorta(resueltoEn)}` : '';
  return `Cerrado${quien}${cuando}.`;
}

/** Fecha y versión que vio el estudiante, y la actual si cambió desde el aviso. */
function textoVersion({ creadoEn, version }: AvisoDeError, versionActual: number): string {
  const actual = version === versionActual ? '' : ` (la actual es la ${String(versionActual)})`;
  return `${fechaCorta(creadoEn)} · versión ${String(version)}${actual}`;
}

interface Acciones {
  enCurso: boolean;
  alCerrar: (aviso: AvisoDeError, estado: CierreAviso) => void;
}

function Aviso({
  aviso,
  versionActual,
  enCurso,
  alCerrar,
}: { aviso: AvisoDeError; versionActual: number } & Acciones) {
  const pendiente = avisoPendiente(aviso);
  return (
    <li className="avisos__aviso">
      <p className="avisos__cabecera">
        <strong>{aviso.motivo.nombre}</strong>
        <span className={`etiqueta etiqueta--${aviso.estado.codigo}`}>{aviso.estado.nombre}</span>
      </p>
      <blockquote className="avisos__comentario">{aviso.comentario}</blockquote>
      <p className="avisos__dato">{textoVersion(aviso, versionActual)}</p>
      {pendiente ? (
        <div className="avisos__acciones">
          <button
            type="button"
            className="boton"
            disabled={enCurso}
            onClick={() => alCerrar(aviso, 'resuelto')}
          >
            Resolver
          </button>
          <button
            type="button"
            className="boton"
            disabled={enCurso}
            onClick={() => alCerrar(aviso, 'descartado')}
          >
            Descartar
          </button>
        </div>
      ) : (
        <p className="avisos__dato">{textoCerrado(aviso)}</p>
      )}
    </li>
  );
}

function ZonaAnulacion({
  enCurso,
  botonAnular,
  alAnular,
}: {
  enCurso: boolean;
  botonAnular: Ref<HTMLButtonElement>;
  alAnular: () => void;
}) {
  return (
    <div className="avisos__peligro">
      <p>
        <strong>Anular la pregunta:</strong> deja de entregarse, no cuenta en los resultados de las
        evaluaciones donde apareció y esos resultados se recalculan. No se puede deshacer.
      </p>
      <button
        type="button"
        ref={botonAnular}
        className="boton boton--peligro"
        disabled={enCurso}
        onClick={alAnular}
      >
        Anular pregunta
      </button>
    </div>
  );
}

export function PanelPregunta({
  grupo,
  enCurso,
  alCerrar,
  botonAnular,
  alAnular,
}: {
  grupo: PreguntaConAvisos;
  botonAnular: Ref<HTMLButtonElement>;
  alAnular: () => void;
} & Acciones) {
  const { pregunta } = grupo;
  return (
    <section className="panel avisos__panel" aria-labelledby="avisos-pregunta">
      <div className="pagina__encabezado">
        <h2 id="avisos-pregunta">
          {`P-${String(pregunta.id)} · ${pregunta.prueba.codigo} · ${pregunta.contenido.nombre}`}
        </h2>
        <Link to={`/banco/${String(pregunta.id)}`}>Abrir pregunta</Link>
      </div>
      <p className="avisos__dato">
        <span className={`etiqueta etiqueta--${pregunta.estado.codigo}`}>
          {pregunta.estado.nombre}
        </span>{' '}
        {pregunta.resumen}
      </p>
      <ul className="avisos__lista">
        {grupo.avisos.map((aviso) => (
          <Aviso
            key={aviso.id}
            aviso={aviso}
            versionActual={pregunta.versionActual}
            enCurso={enCurso}
            alCerrar={alCerrar}
          />
        ))}
      </ul>
      {sePuedeAnular(grupo) && (
        <ZonaAnulacion enCurso={enCurso} botonAnular={botonAnular} alAnular={alAnular} />
      )}
    </section>
  );
}
