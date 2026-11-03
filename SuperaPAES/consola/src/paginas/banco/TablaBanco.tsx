// Tabla del banco (C02, HU-11 esc. 2): cada pregunta con su prueba, eje y contenido, su estado, su
// origen y su dificultad, y la marca de posiblemente confusa. Cada fila abre su pregunta en C03 (HU-12.3):
// «Editar» en borrador u observada (RF-G09) y «Ver» en las demás, y la acción de su etapa: enviar a
// revisión (HU-21), publicar, retirar o volver a borrador (HU-24, CU-21).
import { Link } from 'react-router';
import {
  type AccionDelBanco,
  type AccionesDelBanco,
  accionDe,
  claveDeAccion,
} from '../../estado/acciones-banco';
import type { Opcion, OrigenPregunta, PreguntaDelBanco } from '../../tipos';

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

/** El texto del botón de cada acción: antes, mientras se hace y ya hecha. */
const TEXTOS: Record<AccionDelBanco, [string, string, string]> = {
  enviar: ['Enviar a revisión', 'Enviando…', 'Enviada'],
  publicar: ['Publicar', 'Publicando…', 'Publicada'],
  retirar: ['Retirar', 'Retirando…', 'Retirada'],
  borrador: ['Volver a borrador', 'Volviendo…', 'En borrador'],
};

function textoDelBoton({ enCurso, hechas }: AccionesDelBanco, id: number, accion: AccionDelBanco) {
  const [antes, durante, despues] = TEXTOS[accion];
  if (enCurso === id) return durante;
  return hechas.has(claveDeAccion(id, accion)) ? despues : antes;
}

/**
 * «Editar» en una etapa editable (RF-G09; la API dice cuáles) y «Ver» en las demás, y la acción de su
 * etapa, de a una pregunta.
 */
function Acciones({
  pregunta,
  acciones,
}: {
  pregunta: PreguntaDelBanco;
  acciones?: AccionesDelBanco;
}) {
  const accion = accionDe(pregunta);
  return (
    <div className="tabla__acciones">
      <Link to={`/banco/${String(pregunta.id)}`}>{pregunta.editable ? 'Editar' : 'Ver'}</Link>
      {accion && acciones && (
        <button
          type="button"
          className="boton"
          disabled={
            acciones.enCurso !== null || acciones.hechas.has(claveDeAccion(pregunta.id, accion))
          }
          onClick={() => acciones.ejecutar(pregunta.id, accion)}
        >
          {textoDelBoton(acciones, pregunta.id, accion)}
        </button>
      )}
    </div>
  );
}

function FilaBanco({
  pregunta,
  acciones,
}: {
  pregunta: PreguntaDelBanco;
  acciones?: AccionesDelBanco;
}) {
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
        <Acciones pregunta={pregunta} acciones={acciones} />
      </td>
    </tr>
  );
}

export function TablaBanco({
  preguntas,
  acciones,
}: {
  preguntas: readonly PreguntaDelBanco[];
  acciones?: AccionesDelBanco;
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
            <FilaBanco key={pregunta.id} pregunta={pregunta} acciones={acciones} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
