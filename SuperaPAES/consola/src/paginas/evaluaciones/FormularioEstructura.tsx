// Edición de una estructura de C08 (CU-31 paso 3). Muestra la suma del reparto mientras se escribe; quien valida
// es el servidor, que explica el motivo si no cuadra (4.a).
import { useState, type FormEvent } from 'react';
import { Alerta } from '../../componentes/Alerta';
import type { EdicionEstructura, Estructura, FilaReparto } from '../../tipos/evaluaciones';
import {
  camposDe,
  edicionDe,
  sumaDelReparto,
  type CamposEstructura,
} from '../../utilidades/evaluaciones';

function CampoNumero({
  etiqueta,
  valor,
  alCambiar,
}: {
  etiqueta: string;
  valor: string;
  alCambiar: (valor: string) => void;
}) {
  return (
    <label className="campo">
      {etiqueta}
      <input
        type="number"
        min={0}
        value={valor}
        onChange={(evento) => alCambiar(evento.target.value)}
      />
    </label>
  );
}

function CamposValores({
  campos,
  conReparto,
  alCambiar,
}: {
  campos: CamposEstructura;
  conReparto: boolean;
  alCambiar: (cambio: Partial<CamposEstructura>) => void;
}) {
  const campo = (etiqueta: string, clave: keyof Omit<CamposEstructura, 'cantidades'>) => {
    const valor = campos[clave];
    return (
      valor !== null && (
        <CampoNumero
          etiqueta={etiqueta}
          valor={valor}
          alCambiar={(nuevo) => alCambiar({ [clave]: nuevo })}
        />
      )
    );
  };
  return (
    <div className="evaluaciones__campos">
      {!conReparto && campo('Mínimo de preguntas', 'minimo')}
      {campo(conReparto ? 'Preguntas' : 'Máximo de preguntas', 'maximo')}
      {campo('No puntúan', 'noPuntuan')}
      {campo('Tiempo (minutos)', 'tiempo')}
      {campo('Textos de lectura', 'textos')}
      {campo('Gratis al mes', 'gratis')}
    </div>
  );
}

function CamposReparto({
  reparto,
  cantidades,
  total,
  alCambiar,
}: {
  reparto: readonly FilaReparto[];
  cantidades: Record<string, string>;
  total: number;
  alCambiar: (id: number, valor: string) => void;
}) {
  const suma = sumaDelReparto(Object.values(cantidades).map(Number));
  return (
    <fieldset className="evaluaciones__reparto">
      <legend>Reparto</legend>
      {reparto.map(({ id, nombre }) => (
        <CampoNumero
          key={id}
          etiqueta={nombre}
          valor={cantidades[id] ?? ''}
          alCambiar={(valor) => alCambiar(id, valor)}
        />
      ))}
      <p className={suma === total ? 'estado__ok' : 'estado__error'} aria-live="polite">
        Total: {suma} de {total}
      </p>
      <p className="campo__ayuda">
        El reparto sigue la cantidad que publica el DEMRE. Si no la publica, se usa un reparto
        parejo provisorio hasta que exista el oficial. Debe sumar la cantidad de preguntas.
      </p>
    </fieldset>
  );
}

export function FormularioEstructura({
  estructura,
  guardando,
  error,
  alGuardar,
  alCancelar,
}: {
  estructura: Estructura;
  guardando: boolean;
  error: string | null;
  alGuardar: (datos: EdicionEstructura) => void;
  alCancelar: () => void;
}) {
  const [campos, setCampos] = useState(() => camposDe(estructura));
  const conReparto = estructura.reparto.length > 0;

  const enviar = (evento: FormEvent) => {
    evento.preventDefault();
    alGuardar(edicionDe(estructura, campos));
  };

  return (
    <form className="panel panel--ancho" onSubmit={enviar} noValidate>
      <h2>{estructura.tipoNombre}</h2>
      <CamposValores
        campos={campos}
        conReparto={conReparto}
        alCambiar={(cambio) => setCampos({ ...campos, ...cambio })}
      />
      {conReparto && (
        <CamposReparto
          reparto={estructura.reparto}
          cantidades={campos.cantidades}
          total={Number(campos.maximo)}
          alCambiar={(id, valor) =>
            setCampos({ ...campos, cantidades: { ...campos.cantidades, [id]: valor } })
          }
        />
      )}
      {error && <Alerta texto={error} />}
      <div className="panel__acciones">
        <button type="submit" className="boton boton--primario" disabled={guardando}>
          {guardando ? 'Guardando…' : 'Guardar estructura'}
        </button>
        <button type="button" className="boton" onClick={alCancelar}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
