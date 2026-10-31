// Partes del formulario C03 (HU-12.3): temario encadenado, alternativas según la prueba (RN-08) y
// mensajes de error bajo cada campo. Solo presentan: las reglas están en estado/formulario-pregunta.ts.
import { MensajeError } from '../../componentes/MensajeError';
import { Selector } from '../../componentes/Selector';
import type { useEditorPregunta } from '../../estado/editor-pregunta';
import { cantidadDeAlternativas, pruebaDe } from '../../estado/formulario-pregunta';
import type { Letra, OpcionesFiltrosBanco, PruebaTemario } from '../../tipos';
import { deLista, deTemario, numero } from '../../utilidades/opciones';

export type Editor = ReturnType<typeof useEditorPregunta>;

/** Prueba, eje y contenido en cascada: elegir otra prueba u otro eje limpia lo que depende de él. */
function CamposContexto({
  editor,
  pruebas,
}: {
  editor: Editor;
  pruebas: readonly PruebaTemario[];
}) {
  const { campos, errores } = editor;
  const prueba = pruebaDe(pruebas, campos.pruebaId);
  const ejes = prueba?.ejes ?? [];
  const contenidos = ejes.find((eje) => eje.id === campos.ejeId)?.contenidos ?? [];
  return (
    <>
      <Selector
        etiqueta="Prueba"
        valor={campos.pruebaId}
        opciones={deTemario(pruebas)}
        textoVacio="Elige la prueba"
        alCambiar={(valor) => editor.elegirPrueba(numero(valor))}
      >
        <MensajeError id="error-prueba" texto={errores.pruebaId} />
      </Selector>
      <Selector
        etiqueta="Eje"
        valor={campos.ejeId}
        opciones={deTemario(ejes)}
        textoVacio="Elige el eje"
        deshabilitado={!prueba}
        alCambiar={(valor) => editor.elegirEje(numero(valor))}
      />
      <Selector
        etiqueta="Contenido"
        valor={campos.contenidoId}
        opciones={deTemario(contenidos)}
        textoVacio="Elige el contenido"
        deshabilitado={campos.ejeId === undefined}
        alCambiar={(valor) => editor.cambiar({ contenidoId: numero(valor) })}
      >
        <MensajeError id="error-contenido" texto={errores.contenidoId} />
      </Selector>
    </>
  );
}

/** Tipo de pregunta y habilidad de la prueba, y dificultad sugerida (opcional). */
function CamposClasificacion({
  editor,
  prueba,
  opciones,
}: {
  editor: Editor;
  prueba: PruebaTemario | undefined;
  opciones: OpcionesFiltrosBanco;
}) {
  const { campos, errores } = editor;
  return (
    <>
      <Selector
        etiqueta="Tipo de pregunta"
        valor={campos.tipoPregunta}
        opciones={deLista(prueba?.tiposPregunta ?? [])}
        textoVacio={prueba ? null : 'Elige la prueba'}
        deshabilitado={!prueba}
        alCambiar={(valor) => editor.cambiar({ tipoPregunta: valor })}
      >
        <MensajeError id="error-tipo" texto={errores.tipoPregunta} />
      </Selector>
      <Selector
        etiqueta="Habilidad"
        valor={campos.habilidadId}
        opciones={deTemario(prueba?.habilidades ?? [])}
        textoVacio="Elige la habilidad"
        deshabilitado={!prueba}
        alCambiar={(valor) => editor.cambiar({ habilidadId: numero(valor) })}
      >
        <MensajeError id="error-habilidad" texto={errores.habilidadId} />
      </Selector>
      <Selector
        etiqueta="Dificultad sugerida"
        valor={campos.dificultadSugerida}
        opciones={deLista(opciones.dificultades)}
        textoVacio="Sin sugerir"
        alCambiar={(valor) => editor.cambiar({ dificultadSugerida: valor })}
      >
        <MensajeError id="error-dificultad" texto={errores.dificultadSugerida} />
      </Selector>
    </>
  );
}

export function CamposTemario({
  editor,
  opciones,
}: {
  editor: Editor;
  opciones: OpcionesFiltrosBanco;
}) {
  const prueba = pruebaDe(opciones.pruebas, editor.campos.pruebaId);
  return (
    <div className="formulario-pregunta__grilla">
      <CamposContexto editor={editor} pruebas={opciones.pruebas} />
      <CamposClasificacion editor={editor} prueba={prueba} opciones={opciones} />
    </div>
  );
}

function FilaAlternativa({
  editor,
  letra,
  texto,
}: {
  editor: Editor;
  letra: Letra;
  texto: string;
}) {
  const correcta = editor.campos.correcta === letra;
  return (
    <div className={correcta ? 'alternativa alternativa--correcta' : 'alternativa'}>
      <input
        type="radio"
        name="correcta"
        aria-label={`La ${letra} es la correcta`}
        checked={correcta}
        onChange={() => editor.cambiar({ correcta: letra })}
      />
      <label className="alternativa__texto">
        <span className="alternativa__letra">{letra}</span>
        <input
          value={texto}
          aria-label={`Texto de la alternativa ${letra}`}
          onChange={(evento) => editor.cambiarAlternativa(letra, { texto: evento.target.value })}
        />
      </label>
      {correcta && <span className="etiqueta etiqueta--aprobada">Correcta</span>}
    </div>
  );
}

/** Alternativas A a E con una sola correcta (botón de opción); en M2 y Ciencias, agregar o quitar la E. */
export function CampoAlternativas({
  editor,
  prueba,
}: {
  editor: Editor;
  prueba: PruebaTemario | undefined;
}) {
  const { campos, errores } = editor;
  const faltan = prueba !== undefined && campos.alternativas.length < prueba.opcionesMax;
  return (
    <fieldset className="campo alternativas" aria-describedby="error-alternativas">
      <legend>
        Alternativas
        {prueba &&
          ` · ${prueba.codigo} admite ${cantidadDeAlternativas(prueba)} · marca la correcta`}
      </legend>
      {campos.alternativas.map(({ letra, texto }) => (
        <FilaAlternativa key={letra} editor={editor} letra={letra} texto={texto} />
      ))}
      {prueba && prueba.opcionesMax > prueba.opcionesMin && (
        <button
          type="button"
          className="boton alternativas__cantidad"
          onClick={() => editor.cambiarCantidad(faltan)}
        >
          {faltan ? 'Agregar la E' : 'Quitar la E'}
        </button>
      )}
      <MensajeError id="error-alternativas" texto={errores.alternativas} />
    </fieldset>
  );
}
