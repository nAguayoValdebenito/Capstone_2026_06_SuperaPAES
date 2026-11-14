// Tabla del banco (C02, HU-11 esc. 2): cada pregunta con su prueba, eje y contenido, su estado, su
// origen y su dificultad, y la marca de posiblemente confusa. Cada fila abre su pregunta en C03 (HU-12.3):
// «Editar» en borrador u observada (RF-G09) y «Ver» en las demás, y la acción de su etapa: enviar a
// revisión (HU-21), publicar, retirar o volver a borrador (HU-24, CU-21). Con las estadísticas de la
// página (HU-53), una columna dice sus intentos, su acierto y su tiempo promedio. El ID va en letra de datos
// con el origen debajo, el enunciado recortado y los estados apilados. Las filas no llevan atributos
// (pruebas/tabla-banco.tsx parte el HTML por «<tr>»).
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { EstadoVacio } from '../../componentes/EstadoVacio';
import {
  type AccionDelBanco,
  type AccionesDelBanco,
  accionDe,
  claveDeAccion,
} from '../../estado/acciones-banco';
import { textoDeEstadistica } from '../../estado/calibracion';
import { estiloDeSello } from '../../estado/sello-prueba';
import type { Opcion, OrigenPregunta, PreguntaDelBanco } from '../../tipos';
import { textoPlano } from '../../utilidades/texto-plano';
import type { EstadisticaPregunta } from '../../tipos/calibracion';
import { codigoDePregunta } from '../../utilidades/revision';

/** Estadísticas de las preguntas de la página por id (HU-53); sin ellas, la columna no aparece. */
type Estadisticas = ReadonlyMap<string, EstadisticaPregunta>;

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
  estadisticas,
}: {
  pregunta: PreguntaDelBanco;
  acciones?: AccionesDelBanco;
  estadisticas?: Estadisticas;
}) {
  return (
    <tr>
      <td>
        <span className="tabla__id">{codigoDePregunta(pregunta.id)}</span>
        <span className="tabla__secundario">{NOMBRE_ORIGEN[pregunta.origen]}</span>
      </td>
      <td>
        <span className="tabla__recorte">{textoPlano(pregunta.resumen)}</span>
      </td>
      <td title={pregunta.prueba.nombre}>
        <span className="sello">
          <span className="sello__marca" style={estiloDeSello(pregunta.prueba.codigo)}>
            {pregunta.prueba.codigo}
          </span>
        </span>
      </td>
      <td>
        {pregunta.eje.nombre}
        <span className="tabla__secundario">{pregunta.contenido.nombre}</span>
      </td>
      <td>
        <div className="tabla__pilas">
          <span className={`etiqueta etiqueta--${pregunta.estado.codigo}`}>
            {pregunta.estado.nombre}
          </span>
          {pregunta.posibleAmbigua && (
            <span className="etiqueta etiqueta--confusa">Posiblemente confusa</span>
          )}
        </div>
      </td>
      <td>
        <Dificultad pregunta={pregunta} />
      </td>
      {estadisticas && <td>{textoDeEstadistica(estadisticas.get(String(pregunta.id)))}</td>}
      <td>{fecha.format(new Date(pregunta.actualizadoEn))}</td>
      <td>
        <Acciones pregunta={pregunta} acciones={acciones} />
      </td>
    </tr>
  );
}

/** Sin resultados: el estado vacío y, si hay filtros, la salida para limpiarlos. */
function SinPreguntas({ alLimpiar }: { alLimpiar?: () => void }) {
  let accion: ReactNode = null;
  if (alLimpiar) {
    accion = (
      <button type="button" className="boton boton--chico" onClick={alLimpiar}>
        Limpiar filtros
      </button>
    );
  }
  return <EstadoVacio titulo="No hay preguntas que cumplan el filtro." accion={accion} />;
}

export function TablaBanco({
  preguntas,
  acciones,
  estadisticas,
  alLimpiar,
}: {
  preguntas: readonly PreguntaDelBanco[];
  acciones?: AccionesDelBanco;
  estadisticas?: Estadisticas;
  /** Con filtros activos, el estado vacío ofrece limpiarlos. */
  alLimpiar?: () => void;
}) {
  if (preguntas.length === 0) {
    return <SinPreguntas alLimpiar={alLimpiar} />;
  }
  return (
    <div className="tabla-desplazable">
      <table className="tabla tabla--banco">
        <thead>
          <tr>
            <th scope="col">ID y origen</th>
            <th scope="col">Pregunta</th>
            <th scope="col">Prueba</th>
            <th scope="col">Eje y contenido</th>
            <th scope="col">Estado</th>
            <th scope="col">Dificultad</th>
            {estadisticas && <th scope="col">Respuestas</th>}
            <th scope="col">Actualizada</th>
            <th scope="col">Acción</th>
          </tr>
        </thead>
        <tbody>
          {preguntas.map((pregunta) => (
            <FilaBanco
              key={pregunta.id}
              pregunta={pregunta}
              acciones={acciones}
              estadisticas={estadisticas}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
