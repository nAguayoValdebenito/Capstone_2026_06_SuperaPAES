// C04 · Importar preguntas (HU-13.2, RF-G05, CU-16): el CSV de preguntas y, si hay, el de textos de
// lectura; el informe con las filas leídas, por crear, omitidas y con error, y el motivo de cada error;
// la declaración del origen (RN-29) y la confirmación. Se abre desde el banco y vuelve a él. La lógica
// está en src/estado/importacion.ts. HU-13.3 permite descargar las plantillas CSV.
import { Link } from 'react-router';
import {
  type CualArchivo,
  type Importacion,
  puedeConfirmar,
  useImportacion,
} from '../../estado/importacion';
import type { ErrorDeFila, InformeImportacion } from '../../tipos';
import { PlantillasImportacion } from './PlantillasImportacion';

/** Columnas de la plantilla (CU-16 paso 3 y alternativo 3.a), en el orden de la API (HU-13.1). */
const COLUMNAS_PREGUNTAS =
  'prueba, eje, contenido, habilidad, tipo, enunciado, codigo_texto, alternativa_a a alternativa_e, correcta, explicacion, dificultad_sugerida, imagen';
const COLUMNAS_TEXTOS = 'codigo, tipo_texto, titulo, contenido';

interface PropiedadesArchivo {
  cual: CualArchivo;
  etiqueta: string;
  nombre: string | null;
  alCambiar: Importacion['cambiarArchivo'];
  /** Mientras se importa, los archivos no cambian: lo que se importa es lo que se revisó. */
  bloqueado: boolean;
}

/**
 * El selector del navegador, oculto (dice «Sin archivos seleccionados» aunque haya uno): su botón
 * visible es la etiqueta «Elegir archivo» o «Cambiar archivo», como en C04.
 */
function SelectorOculto({
  cual,
  alCambiar,
  bloqueado,
}: Pick<PropiedadesArchivo, 'cual' | 'alCambiar' | 'bloqueado'>) {
  const id = `archivo-${cual}`;
  return (
    <input
      id={id}
      className="importar__entrada"
      type="file"
      accept=".csv,text/csv"
      aria-labelledby={`${id}-titulo`}
      disabled={bloqueado}
      onChange={(evento) => {
        const archivo = evento.target.files?.[0];
        // Cancelar el diálogo no cambia el archivo elegido; vaciarlo permite elegir el mismo otra vez.
        if (archivo) alCambiar(cual, archivo);
        evento.target.value = '';
      }}
    />
  );
}

function ElegirArchivo({ cual, etiqueta, nombre, alCambiar, bloqueado }: PropiedadesArchivo) {
  const id = `archivo-${cual}`;
  return (
    <div className="importar__archivo">
      <span id={`${id}-titulo`} className="importar__titulo">
        {etiqueta}
      </span>
      <p className="importar__elegido">
        {nombre ? (
          <>
            Elegido: <strong>{nombre}</strong>
          </>
        ) : (
          'Ningún archivo elegido.'
        )}
      </p>
      <div className="importar__botones">
        <SelectorOculto cual={cual} alCambiar={alCambiar} bloqueado={bloqueado} />
        <label htmlFor={id} className="boton">
          {nombre ? 'Cambiar archivo' : 'Elegir archivo'}
        </label>
        {cual === 'textos' && nombre && (
          <button
            type="button"
            className="boton"
            disabled={bloqueado}
            onClick={() => alCambiar('textos', null)}
          >
            Quitar
          </button>
        )}
      </div>
    </div>
  );
}

function Archivos({ importacion }: { importacion: Importacion }) {
  return (
    <div className="panel panel--ancho">
      <h2>Archivos</h2>
      <PlantillasImportacion />
      <div className="importar__archivos">
        <ElegirArchivo
          cual="preguntas"
          etiqueta="Preguntas (CSV UTF-8, una fila por pregunta)"
          nombre={importacion.nombres.preguntas}
          alCambiar={importacion.cambiarArchivo}
          bloqueado={importacion.enviando}
        />
        <ElegirArchivo
          cual="textos"
          etiqueta="Textos de lectura (CSV UTF-8, opcional)"
          nombre={importacion.nombres.textos}
          alCambiar={importacion.cambiarArchivo}
          bloqueado={importacion.enviando}
        />
      </div>
      <details className="importar__plantilla">
        <summary>Columnas de la plantilla</summary>
        <p>
          <strong>Preguntas:</strong> <code>{COLUMNAS_PREGUNTAS}</code>.
        </p>
        <p>
          <strong>Textos de lectura:</strong> <code>{COLUMNAS_TEXTOS}</code>. Cada pregunta de
          Competencia Lectora nombra su texto en <code>codigo_texto</code>.
        </p>
        <p className="campo__ayuda">
          Prueba, eje, contenido, habilidad, tipo y dificultad van con su nombre del temario. Las
          fórmulas van en LaTeX entre signos $. La dificultad es solo una sugerencia: la asignan los
          docentes al revisar. Las imágenes todavía no se importan.
        </p>
      </details>
    </div>
  );
}

function Contadores({ informe }: { informe: InformeImportacion }) {
  const contadores = [
    ['Filas leídas', informe.filasLeidas],
    ['Por crear', informe.porCrear],
    ['Omitidas', informe.omitidas],
    ['Con error', informe.conError],
  ] as const;
  return (
    <dl className="contadores">
      {contadores.map(([nombre, valor]) => (
        <div
          key={nombre}
          className={nombre === 'Con error' && valor > 0 ? 'contador contador--error' : 'contador'}
        >
          <dt>{nombre}</dt>
          <dd>{valor}</dd>
        </div>
      ))}
    </dl>
  );
}

function TablaErrores({ errores }: { errores: readonly ErrorDeFila[] }) {
  if (errores.length === 0) return <p className="pagina__aviso">No hay filas con errores.</p>;
  return (
    <div className="tabla-desplazable">
      <table className="tabla">
        <caption>Filas con errores</caption>
        <thead>
          <tr>
            <th scope="col">Archivo</th>
            <th scope="col">Fila</th>
            <th scope="col">Pregunta o texto</th>
            <th scope="col">Error</th>
          </tr>
        </thead>
        <tbody>
          {errores.map((error) => (
            <tr key={`${error.archivo}-${String(error.fila)}`}>
              <td>{error.archivo === 'preguntas' ? 'Preguntas' : 'Textos'}</td>
              <td>{error.fila}</td>
              <td>{error.resumen || '—'}</td>
              <td>
                {error.motivos.length === 1 ? (
                  error.motivos[0]
                ) : (
                  <ul className="importar__motivos">
                    {error.motivos.map((motivo) => (
                      <li key={motivo}>{motivo}</li>
                    ))}
                  </ul>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Qué se crea al confirmar. */
function textoDeConfirmacion({ porCrear, textosPorCrear }: InformeImportacion): string {
  if (porCrear === 0) return 'El archivo no tiene preguntas válidas para importar.';
  const preguntas =
    porCrear === 1 ? 'Se crea 1 borrador' : `Se crean ${String(porCrear)} borradores`;
  const textos =
    textosPorCrear === 0
      ? ''
      : ` y ${textosPorCrear === 1 ? '1 texto' : `${String(textosPorCrear)} textos`} de lectura`;
  return `${preguntas} con origen importación${textos}. Las filas con error no se importan. Después se envían a revisión y los docentes asignan su dificultad.`;
}

function Confirmacion({
  importacion,
  informe,
}: {
  importacion: Importacion;
  informe: InformeImportacion;
}) {
  const { revision, declara, enviando } = importacion;
  return (
    <form className="panel panel--ancho importar__confirmar" onSubmit={importacion.confirmar}>
      <label className="campo__opcion">
        <input
          type="checkbox"
          checked={declara}
          onChange={(evento) => importacion.cambiarDeclaracion(evento.target.checked)}
        />
        Declaro que estas preguntas son propias o tienen permiso de uso y que no provienen de los
        facsímiles del DEMRE ni de otro material protegido.
      </label>
      <p className="pagina__aviso">{textoDeConfirmacion(informe)}</p>
      {importacion.error && (
        <p className="aviso aviso--error" role="alert">
          {importacion.error}
        </p>
      )}
      <div className="panel__acciones">
        <button
          type="submit"
          className="boton boton--primario"
          disabled={!puedeConfirmar(revision, declara, enviando)}
        >
          {enviando ? 'Importando…' : 'Confirmar importación'}
        </button>
      </div>
    </form>
  );
}

function Resultado({ importacion }: { importacion: Importacion }) {
  const { revision } = importacion;
  switch (revision.tipo) {
    case 'sin_archivo':
      return null;
    case 'revisando':
      return <p aria-live="polite">Revisando el archivo…</p>;
    case 'rechazada':
      return (
        <p className="aviso aviso--error" role="alert">
          {revision.mensaje}
        </p>
      );
    default:
      return (
        <>
          <Contadores informe={revision.informe} />
          <TablaErrores errores={revision.informe.errores} />
          <Confirmacion importacion={importacion} informe={revision.informe} />
        </>
      );
  }
}

/** La pantalla con su estado (exportada para las pruebas). */
export function ContenidoImportacion({ importacion }: { importacion: Importacion }) {
  return (
    <section className="pagina pagina--ancha">
      <header className="pagina__encabezado">
        <div>
          <h1>Importar preguntas</h1>
          <p className="pagina__aviso">
            Carga muchas preguntas de una vez con la plantilla en CSV. Primero revisamos cada fila;
            nada se guarda hasta que confirmes.
          </p>
        </div>
        <div className="pagina__acciones">
          <Link className="boton" to="/banco">
            Volver al banco
          </Link>
        </div>
      </header>
      <Archivos importacion={importacion} />
      <Resultado importacion={importacion} />
    </section>
  );
}

export function PaginaImportar() {
  return <ContenidoImportacion importacion={useImportacion()} />;
}
