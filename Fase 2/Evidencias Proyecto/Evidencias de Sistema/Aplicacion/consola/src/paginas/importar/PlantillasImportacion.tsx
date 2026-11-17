import { usePlantillasImportacion } from '../../estado/plantillas-importacion';

/** HU-13.3: una plantilla por archivo, disponible antes de elegir preguntas para importar. */
export function PlantillasImportacion() {
  const { descargando, error, descargar } = usePlantillasImportacion();
  return (
    <div>
      <div className="pagina__acciones" aria-busy={descargando}>
        <button
          type="button"
          className="boton"
          disabled={descargando}
          onClick={() => descargar('preguntas')}
        >
          Descargar plantilla de preguntas
        </button>
        <button
          type="button"
          className="boton"
          disabled={descargando}
          onClick={() => descargar('textos')}
        >
          Descargar plantilla de textos
        </button>
      </div>
      <p className="campo__ayuda">
        Completa una fila por pregunta y guarda como CSV UTF-8. Para Competencia Lectora, completa
        también los textos y usa el mismo código en codigo y codigo_texto. Las plantillas están
        vacías: agrega solo preguntas propias o con permiso de uso.
      </p>
      {error && (
        <p className="aviso aviso--error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
