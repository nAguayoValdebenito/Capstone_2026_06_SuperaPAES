// Tabla del banco (C02, HU-11 esc. 2): cada pregunta con su prueba, eje y contenido, su estado, su
// origen y su dificultad, y la marca de posiblemente confusa. Cada fila abre su pregunta en C03 (HU-12.3):
// «Editar» en borrador u observada (RF-G09) y «Ver» en las demás. Publicar y enviar a revisión llegan
// con sus historias.
import { Link } from 'react-router';
import type { Opcion, OrigenPregunta, PreguntaDelBanco } from '../../tipos';

/** Etapas en que la pregunta se edita (RF-G09); en las demás, C03 la muestra en solo lectura. */
const ETAPAS_EDITABLES = new Set(['borrador', 'observada']);

const NOMBRE_ORIGEN: Record<OrigenPregunta, string> = {
  manual: 'Manual',
  importacion: 'Importada',
  ia: 'IA',
};

const fecha = new Intl.DateTimeFormat('es-CL', { dateStyle: 'short', timeStyle: 'short' });

const nombreDe = (opcion: Opcion | null) => opcion?.nombre ?? '—';

function Dificultad({ pregunta }: { pregunta: PreguntaDelBanco }) {
  return (
    <>
      {nombreDe(pregunta.dificultadAsignada)}
      {pregunta.dificultadSugerida && (
        <span className="tabla__secundario">Sugerida: {pregunta.dificultadSugerida.nombre}</span>
      )}
    </>
  );
}

function FilaBanco({ pregunta }: { pregunta: PreguntaDelBanco }) {
  return (
    <tr>
      <td>
        {pregunta.resumen}
        {pregunta.posibleAmbigua && (
          <span className="etiqueta etiqueta--confusa">Posiblemente confusa</span>
        )}
      </td>
      <td title={pregunta.prueba.nombre}>{pregunta.prueba.codigo}</td>
      <td>
        {pregunta.eje.nombre}
        <span className="tabla__secundario">{pregunta.contenido.nombre}</span>
      </td>
      <td>
        <span className={`etiqueta etiqueta--${pregunta.estado.codigo}`}>
          {pregunta.estado.nombre}
        </span>
      </td>
      <td>{NOMBRE_ORIGEN[pregunta.origen]}</td>
      <td>
        <Dificultad pregunta={pregunta} />
      </td>
      <td>{fecha.format(new Date(pregunta.actualizadoEn))}</td>
      <td>
        <Link to={`/banco/${String(pregunta.id)}`}>
          {ETAPAS_EDITABLES.has(pregunta.estado.codigo) ? 'Editar' : 'Ver'}
        </Link>
      </td>
    </tr>
  );
}

export function TablaBanco({ preguntas }: { preguntas: readonly PreguntaDelBanco[] }) {
  if (preguntas.length === 0) {
    return <p className="pagina__aviso">No hay preguntas que cumplan el filtro.</p>;
  }
  return (
    <div className="tabla-desplazable">
      <table className="tabla tabla--banco">
        <thead>
          <tr>
            <th scope="col">Pregunta</th>
            <th scope="col">Prueba</th>
            <th scope="col">Eje y contenido</th>
            <th scope="col">Estado</th>
            <th scope="col">Origen</th>
            <th scope="col">Dificultad</th>
            <th scope="col">Actualizada</th>
            <th scope="col">Acción</th>
          </tr>
        </thead>
        <tbody>
          {preguntas.map((pregunta) => (
            <FilaBanco key={pregunta.id} pregunta={pregunta} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
