// Tabla del banco (C02, HU-11 esc. 2): cada pregunta con su prueba, eje y contenido, su estado, su
// origen y su dificultad, y la marca de posiblemente confusa. Cada fila abre su pregunta en C03 (HU-12.3):
// «Editar» en borrador u observada (RF-G09) y «Ver» en las demás. Las preguntas en borrador u observadas
// se envían a revisión desde aquí (HU-21). Publicar llega con su historia.
import { Link } from 'react-router';
import type { EnvioDelBanco } from '../../estado/envio-revision';
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

/** Enviar a revisión (HU-21): solo las preguntas en una etapa editable, de a una. */
type EnvioDeLaTabla = Pick<EnvioDelBanco, 'enviando' | 'enviar'>;

function Acciones({ pregunta, envio }: { pregunta: PreguntaDelBanco; envio?: EnvioDeLaTabla }) {
  const editable = ETAPAS_EDITABLES.has(pregunta.estado.codigo);
  return (
    <div className="tabla__acciones">
      <Link to={`/banco/${String(pregunta.id)}`}>{editable ? 'Editar' : 'Ver'}</Link>
      {editable && envio && (
        <button
          type="button"
          className="boton"
          disabled={envio.enviando !== null}
          onClick={() => envio.enviar(pregunta.id)}
        >
          {envio.enviando === pregunta.id ? 'Enviando…' : 'Enviar a revisión'}
        </button>
      )}
    </div>
  );
}

function FilaBanco({ pregunta, envio }: { pregunta: PreguntaDelBanco; envio?: EnvioDeLaTabla }) {
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
        <Acciones pregunta={pregunta} {...(envio && { envio })} />
      </td>
    </tr>
  );
}

export function TablaBanco({
  preguntas,
  envio,
}: {
  preguntas: readonly PreguntaDelBanco[];
  envio?: EnvioDeLaTabla;
}) {
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
            <FilaBanco key={pregunta.id} pregunta={pregunta} {...(envio && { envio })} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
