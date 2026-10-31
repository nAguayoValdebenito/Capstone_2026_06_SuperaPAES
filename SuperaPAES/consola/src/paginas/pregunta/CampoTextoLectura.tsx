// Texto de lectura de una pregunta de Competencia Lectora (C03, HU-12.2 y HU-12.3, RN-08): elegir uno
// guardado (con búsqueda por título) o escribir uno nuevo, y el orden de la pregunta en el texto.
import { useState } from 'react';
import { Selector } from '../../componentes/Selector';
import { deLista, numero } from '../../utilidades/opciones';
import { useTextosGuardados } from '../../estado/editor-pregunta';
import type { Opcion, TextoDeLectura } from '../../tipos';
import { type Editor } from './CamposPregunta';
import { MensajeError } from '../../componentes/MensajeError';

const tituloDe = (texto: TextoDeLectura) =>
  `${texto.titulo ?? 'Sin título'} · ${texto.tipoTexto.nombre} · ${String(texto.preguntas)} pregunta(s)`;

function TextoGuardado({ editor }: { editor: Editor }) {
  const [buscar, setBuscar] = useState('');
  const { textos, error } = useTextosGuardados(buscar, true);
  const elegido = editor.campos.texto.id;
  const opciones = textos.map((texto) => ({ valor: String(texto.id), texto: tituloDe(texto) }));
  // El texto de una pregunta guardada puede no estar entre los resultados de la búsqueda.
  if (elegido !== undefined && !textos.some((texto) => texto.id === elegido)) {
    opciones.unshift({ valor: String(elegido), texto: `Texto guardado n.º ${String(elegido)}` });
  }
  return (
    <>
      <label className="campo">
        Buscar por título
        <input type="search" value={buscar} onChange={(evento) => setBuscar(evento.target.value)} />
      </label>
      <Selector
        etiqueta="Texto"
        valor={elegido}
        opciones={opciones}
        textoVacio="Elige el texto"
        alCambiar={(valor) => editor.cambiarTexto({ id: numero(valor) })}
      >
        {error && <p className="campo__error">{error}</p>}
        <MensajeError id="error-texto" texto={editor.errores.textoEstimuloId} />
      </Selector>
    </>
  );
}

function TextoNuevo({ editor, tiposTexto }: { editor: Editor; tiposTexto: readonly Opcion[] }) {
  const { nuevo } = editor.campos.texto;
  const cambiar = editor.cambiarTextoNuevo;
  return (
    <>
      <Selector
        etiqueta="Tipo de texto"
        valor={nuevo.tipoTexto}
        opciones={deLista(tiposTexto)}
        textoVacio="Elige el tipo"
        alCambiar={(valor) => cambiar({ tipoTexto: valor })}
      />
      <label className="campo">
        Título
        <input
          value={nuevo.titulo}
          maxLength={200}
          onChange={(e) => cambiar({ titulo: e.target.value })}
        />
      </label>
      <label className="campo">
        Texto (Markdown, con fórmulas en LaTeX)
        <textarea
          rows={6}
          value={nuevo.contenido}
          onChange={(e) => cambiar({ contenido: e.target.value })}
        />
      </label>
      <label className="campo">
        Dirección de la imagen (opcional)
        <input
          value={nuevo.imagenUrl}
          maxLength={300}
          aria-describedby="ayuda-imagen"
          onChange={(e) => cambiar({ imagenUrl: e.target.value })}
        />
        <span id="ayuda-imagen" className="campo__ayuda">
          Para tablas y gráficos: https://… o una ruta relativa, como imagenes/tabla-1.png.
        </span>
      </label>
      <MensajeError id="error-texto-nuevo" texto={editor.errores.textoNuevo} />
    </>
  );
}

export function CampoTextoLectura({
  editor,
  tiposTexto,
}: {
  editor: Editor;
  tiposTexto: readonly Opcion[];
}) {
  const { texto } = editor.campos;
  return (
    <fieldset className="campo texto-lectura">
      <legend>Texto de lectura</legend>
      <div className="texto-lectura__modo">
        <label className="campo__opcion">
          <input
            type="radio"
            name="modo-texto"
            checked={texto.modo === 'guardado'}
            onChange={() => editor.cambiarTexto({ modo: 'guardado' })}
          />
          Elegir uno guardado
        </label>
        <label className="campo__opcion">
          <input
            type="radio"
            name="modo-texto"
            checked={texto.modo === 'nuevo'}
            onChange={() => editor.cambiarTexto({ modo: 'nuevo' })}
          />
          Escribir uno nuevo
        </label>
      </div>
      {texto.modo === 'guardado' ? (
        <TextoGuardado editor={editor} />
      ) : (
        <TextoNuevo editor={editor} tiposTexto={tiposTexto} />
      )}
      <label className="campo texto-lectura__orden">
        Orden de la pregunta en el texto
        <input
          type="number"
          min={1}
          value={texto.orden}
          onChange={(e) => editor.cambiarTexto({ orden: e.target.value })}
        />
        <MensajeError id="error-orden" texto={editor.errores.ordenEnTexto} />
      </label>
    </fieldset>
  );
}
