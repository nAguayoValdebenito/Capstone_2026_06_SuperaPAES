// C03 · Crear o editar pregunta (HU-12.3, RF-G02, RF-G09, CU-15). Se llega desde el banco con «Nueva
// pregunta» (/banco/nueva) o desde una fila (/banco/:id). Una pregunta que no está en borrador ni
// observada se abre en solo lectura. La lógica está en src/estado/editor-pregunta.ts.
import { Link, useParams } from 'react-router';
import { type CargaEditor, useEditorPregunta } from '../../estado/editor-pregunta';
import { pruebaDe } from '../../estado/formulario-pregunta';
import type { PreguntaParaEditar } from '../../tipos';
import { CampoAlternativas, CamposTemario, type Editor } from './CamposPregunta';
import { MensajeError } from '../../componentes/MensajeError';
import { CampoTextoLectura } from './CampoTextoLectura';

const ID_FORMULARIO = 'formulario-pregunta';

/** El id de la ruta: null para una pregunta nueva, NaN si no es un número. */
function idDeLaRuta(id: string | undefined): number | null {
  if (id === undefined) return null;
  return /^[1-9]\d{0,15}$/.test(id) ? Number(id) : Number.NaN;
}

type CargaLista = Extract<CargaEditor, { tipo: 'lista' }>;

function FormularioPregunta({ editor, carga }: { editor: Editor; carga: CargaLista }) {
  const { campos, errores } = editor;
  const prueba = pruebaDe(carga.opciones.pruebas, campos.pruebaId);
  const soloLectura = carga.pregunta !== null && !carga.pregunta.editable;
  return (
    <form
      id={ID_FORMULARIO}
      className="panel formulario-pregunta"
      noValidate
      onSubmit={editor.enviar}
    >
      <fieldset className="formulario-pregunta__campos" disabled={soloLectura || editor.enviando}>
        <CamposTemario editor={editor} opciones={carga.opciones} />
        {prueba?.requiereTexto && (
          <CampoTextoLectura editor={editor} tiposTexto={carga.tiposTexto} />
        )}
        <label className="campo">
          Enunciado (admite fórmulas en LaTeX)
          <textarea
            rows={3}
            value={campos.enunciado}
            aria-describedby="error-enunciado"
            onChange={(e) => editor.cambiar({ enunciado: e.target.value })}
          />
          <MensajeError id="error-enunciado" texto={errores.enunciado} />
        </label>
        <CampoAlternativas editor={editor} prueba={prueba} />
        <label className="campo">
          Explicación
          <textarea
            rows={3}
            value={campos.explicacion}
            aria-describedby="error-explicacion"
            onChange={(e) => editor.cambiar({ explicacion: e.target.value })}
          />
          <MensajeError id="error-explicacion" texto={errores.explicacion} />
        </label>
      </fieldset>
    </form>
  );
}

function Encabezado({ pregunta, editor }: { pregunta: PreguntaParaEditar | null; editor: Editor }) {
  const editable = pregunta === null || pregunta.editable;
  return (
    <header className="pagina__encabezado">
      <div>
        <h1>{pregunta ? `Pregunta ${String(pregunta.id)}` : 'Nueva pregunta'}</h1>
        <p className="pagina__aviso">
          {pregunta
            ? `Banco de preguntas · ${pregunta.estado.nombre} · versión ${String(pregunta.version)}`
            : 'Banco de preguntas · se guarda como borrador.'}
        </p>
      </div>
      <div className="pagina__acciones">
        <Link className="boton" to="/banco">
          {editable ? 'Cancelar' : 'Volver al banco'}
        </Link>
        {editable && (
          <button
            type="submit"
            form={ID_FORMULARIO}
            className="boton boton--primario"
            disabled={editor.enviando}
          >
            {editor.enviando ? 'Guardando…' : pregunta ? 'Guardar cambios' : 'Guardar borrador'}
          </button>
        )}
      </div>
    </header>
  );
}

/** Avisos sobre el formulario: guardado, error general de la API y solo lectura (RF-G09). */
function Avisos({ editor, pregunta }: { editor: Editor; pregunta: PreguntaParaEditar | null }) {
  return (
    <>
      {editor.aviso && (
        <p className="aviso aviso--exito" role="status">
          {editor.aviso}
        </p>
      )}
      {editor.errores.general && (
        <p className="aviso aviso--error" role="alert">
          {editor.errores.general}
        </p>
      )}
      {pregunta && !pregunta.editable && (
        <p className="aviso" role="status">
          La pregunta está «{pregunta.estado.nombre}» y no se puede editar: solo se editan las
          preguntas en borrador u observadas (RF-G09).
        </p>
      )}
    </>
  );
}

function ContenidoPregunta({ editor }: { editor: Editor }) {
  const { carga } = editor;
  if (carga.tipo === 'cargando') return <p aria-live="polite">Cargando la pregunta…</p>;
  if (carga.tipo === 'fallida') {
    return (
      <p className="estado__error" role="alert">
        {carga.mensaje} <span className="estado__codigo">({carga.codigo})</span>
      </p>
    );
  }
  const prueba = pruebaDe(carga.opciones.pruebas, editor.campos.pruebaId);
  return (
    <>
      <Encabezado pregunta={carga.pregunta} editor={editor} />
      <Avisos editor={editor} pregunta={carga.pregunta} />
      <div className="editor-pregunta">
        <FormularioPregunta editor={editor} carga={carga} />
        <aside className="panel vista-previa" aria-label="Vista previa en la app">
          <h2>Vista previa en la app</h2>
          <p className="campo__ayuda">Las fórmulas se ven como las verá el estudiante.</p>
          {prueba?.requiereTexto !== false && (
            <p className="aviso aviso--info">
              En Competencia Lectora la pregunta debe estar ligada a un texto de lectura.
            </p>
          )}
        </aside>
      </div>
    </>
  );
}

function EditorPregunta({ id }: { id: number | null }) {
  const editor = useEditorPregunta(id);
  return <ContenidoPregunta editor={editor} />;
}

export function PaginaPregunta() {
  const id = idDeLaRuta(useParams().id);
  return (
    <section className="pagina pagina--ancha">
      {Number.isNaN(id) ? (
        <p className="estado__error" role="alert">
          La pregunta no existe. <Link to="/banco">Volver al banco</Link>
        </p>
      ) : (
        <EditorPregunta key={id ?? 'nueva'} id={id} />
      )}
    </section>
  );
}
