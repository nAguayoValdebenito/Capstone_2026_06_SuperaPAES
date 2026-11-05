// Formulario del lote de C05 (CU-17 paso 1): prueba, eje, contenido, cantidad y texto de lectura.
import { useState, type FormEvent } from 'react';
import { Alerta } from '../../componentes/Alerta';
import { Selector } from '../../componentes/Selector';
import type { PruebaTemario } from '../../tipos';
import type { PedidoLote } from '../../tipos/generador';
import { CANTIDAD_MAXIMA, errorDelPedido, type CamposLote } from '../../utilidades/generador';
import { deTemario, numero } from '../../utilidades/opciones';

const INICIO: CamposLote = { cantidad: '5', conTexto: false };
/** El servidor genera solo selección múltiple; Suficiencia de Datos llega con HU-20. */
const TIPOS = [{ valor: 'seleccion_multiple', texto: 'Selección múltiple' }];

interface PropiedadesCampos {
  campos: CamposLote;
  alCambiar: (campos: CamposLote) => void;
  pruebas: readonly PruebaTemario[];
}

function CamposTemario({ campos, alCambiar, pruebas }: PropiedadesCampos) {
  const prueba = pruebas.find(({ id }) => id === campos.pruebaId);
  const ejes = prueba?.ejes ?? [];
  const contenidos = ejes.find(({ id }) => id === campos.ejeId)?.contenidos ?? [];
  return (
    <>
      <Selector
        etiqueta="Prueba"
        valor={campos.pruebaId}
        opciones={deTemario(pruebas)}
        textoVacio="Elige la prueba"
        alCambiar={(valor) => alCambiar({ ...INICIO, pruebaId: numero(valor) })}
      />
      <Selector
        etiqueta="Eje"
        valor={campos.ejeId}
        opciones={deTemario(ejes)}
        textoVacio="Elige el eje"
        deshabilitado={!prueba}
        alCambiar={(valor) =>
          alCambiar({ ...campos, ejeId: numero(valor), contenidoId: undefined })
        }
      />
      <Selector
        etiqueta="Contenido"
        valor={campos.contenidoId}
        opciones={deTemario(contenidos)}
        textoVacio="Elige el contenido"
        deshabilitado={campos.ejeId === undefined}
        alCambiar={(valor) => alCambiar({ ...campos, contenidoId: numero(valor) })}
      />
    </>
  );
}

function CamposCantidad({ campos, alCambiar, pruebas }: PropiedadesCampos) {
  const prueba = pruebas.find(({ id }) => id === campos.pruebaId);
  return (
    <>
      <Selector
        etiqueta="Tipo de pregunta"
        valor={TIPOS[0]?.valor}
        opciones={TIPOS}
        textoVacio={null}
        deshabilitado
        alCambiar={() => undefined}
      />
      <label className="campo">
        Cantidad (hasta {CANTIDAD_MAXIMA})
        <input
          type="number"
          min={1}
          max={CANTIDAD_MAXIMA}
          value={campos.cantidad}
          onChange={(evento) => alCambiar({ ...campos, cantidad: evento.target.value })}
        />
      </label>
      <label className="campo__opcion">
        <input
          type="checkbox"
          checked={campos.conTexto}
          disabled={!prueba?.requiereTexto}
          onChange={(evento) => alCambiar({ ...campos, conTexto: evento.target.checked })}
        />
        Generar un texto de lectura con sus preguntas (solo Competencia Lectora)
      </label>
    </>
  );
}

export function FormularioLote({
  pruebas,
  enviando,
  error,
  alPedir,
}: {
  pruebas: readonly PruebaTemario[];
  enviando: boolean;
  error: string | null;
  alPedir: (pedido: PedidoLote) => void;
}) {
  const [campos, setCampos] = useState(INICIO);
  const [problema, setProblema] = useState<string | null>(null);
  const mensaje = problema ?? error;

  const enviar = (evento: FormEvent) => {
    evento.preventDefault();
    const encontrado = errorDelPedido(campos);
    setProblema(encontrado);
    if (encontrado !== null || campos.contenidoId === undefined) return;
    alPedir({
      contenidoId: campos.contenidoId,
      cantidad: Number(campos.cantidad),
      conTexto: campos.conTexto,
    });
  };

  return (
    <form className="panel panel--ancho" onSubmit={enviar} noValidate>
      <h2>Nuevo lote</h2>
      <CamposTemario campos={campos} alCambiar={setCampos} pruebas={pruebas} />
      <CamposCantidad campos={campos} alCambiar={setCampos} pruebas={pruebas} />
      <p className="campo__ayuda">
        Se envían los descriptores del contenido, ejemplos aprobados y la mezcla 30 % fácil, 45 %
        media y 25 % difícil.
      </p>
      {mensaje && <Alerta texto={mensaje} />}
      <button type="submit" className="boton boton--primario" disabled={enviando}>
        {enviando ? 'Enviando…' : 'Generar lote'}
      </button>
    </form>
  );
}
