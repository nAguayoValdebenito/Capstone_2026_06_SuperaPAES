// Tabla del banco (C02, HU-11 esc. 2): cada pregunta con su prueba, eje y contenido, su estado, su
// origen y su dificultad, y la marca de posiblemente confusa. Las acciones (publicar, ver revisión,
// editar) llegan con sus historias.
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
          </tr>
        </thead>
        <tbody>
          {preguntas.map((pregunta) => (
            <tr key={pregunta.id}>
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
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
