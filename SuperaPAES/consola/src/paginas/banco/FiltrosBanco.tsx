// Filtros del banco (C02, HU-11 esc. 1, RF-G01): prueba, eje y contenido en cascada, habilidad de la
// prueba, estado, origen y dificultad asignada. Solo presenta: los cambios los aplica useBanco.
import { contenidosDisponibles, ejesDisponibles, habilidadesDisponibles } from '../../estado/banco';
import type { FiltrosBanco as Filtros, OpcionesFiltrosBanco, OrigenPregunta } from '../../tipos';

interface Propiedades {
  opciones: OpcionesFiltrosBanco;
  filtros: Filtros;
  alCambiar: <C extends keyof Filtros>(campo: C, valor: Filtros[C] | undefined) => void;
  alLimpiar: () => void;
}

interface OpcionSelector {
  valor: string;
  texto: string;
}

const numero = (valor: string) => (valor === '' ? undefined : Number(valor));
const texto = (valor: string) => (valor === '' ? undefined : valor);

function Selector({
  etiqueta,
  valor,
  opciones,
  deshabilitado = false,
  alCambiar,
}: {
  etiqueta: string;
  valor: string | number | undefined;
  opciones: OpcionSelector[];
  deshabilitado?: boolean;
  alCambiar: (valor: string) => void;
}) {
  return (
    <label className="campo">
      {etiqueta}
      <select
        value={valor ?? ''}
        disabled={deshabilitado}
        onChange={(evento) => alCambiar(evento.target.value)}
      >
        <option value="">Todos</option>
        {opciones.map((opcion) => (
          <option key={opcion.valor} value={opcion.valor}>
            {opcion.texto}
          </option>
        ))}
      </select>
    </label>
  );
}

const deTemario = (items: readonly { id: number; nombre: string }[]): OpcionSelector[] =>
  items.map((item) => ({ valor: String(item.id), texto: item.nombre }));

const deLista = (items: readonly { codigo: string; nombre: string }[]): OpcionSelector[] =>
  items.map((item) => ({ valor: item.codigo, texto: item.nombre }));

function FiltrosTemario({ opciones, filtros, alCambiar }: Omit<Propiedades, 'alLimpiar'>) {
  const ejes = ejesDisponibles(opciones.pruebas, filtros);
  const contenidos = contenidosDisponibles(opciones.pruebas, filtros);
  const habilidades = habilidadesDisponibles(opciones.pruebas, filtros);
  return (
    <>
      <Selector
        etiqueta="Prueba"
        valor={filtros.prueba}
        opciones={opciones.pruebas.map((p) => ({ valor: String(p.id), texto: p.nombre }))}
        alCambiar={(valor) => alCambiar('prueba', numero(valor))}
      />
      <Selector
        etiqueta="Eje"
        valor={filtros.eje}
        opciones={deTemario(ejes)}
        deshabilitado={filtros.prueba === undefined}
        alCambiar={(valor) => alCambiar('eje', numero(valor))}
      />
      <Selector
        etiqueta="Contenido"
        valor={filtros.contenido}
        opciones={deTemario(contenidos)}
        deshabilitado={filtros.eje === undefined}
        alCambiar={(valor) => alCambiar('contenido', numero(valor))}
      />
      <Selector
        etiqueta="Habilidad"
        valor={filtros.habilidad}
        opciones={deTemario(habilidades)}
        deshabilitado={filtros.prueba === undefined}
        alCambiar={(valor) => alCambiar('habilidad', numero(valor))}
      />
    </>
  );
}

export function FiltrosBanco({ opciones, filtros, alCambiar, alLimpiar }: Propiedades) {
  const hayFiltros = Object.keys(filtros).length > 0;
  return (
    <form className="filtros" aria-label="Filtros del banco" onSubmit={(e) => e.preventDefault()}>
      <FiltrosTemario opciones={opciones} filtros={filtros} alCambiar={alCambiar} />
      <Selector
        etiqueta="Estado"
        valor={filtros.estado}
        opciones={deLista(opciones.estados)}
        alCambiar={(valor) => alCambiar('estado', texto(valor))}
      />
      <Selector
        etiqueta="Origen"
        valor={filtros.origen}
        opciones={deLista(opciones.origenes)}
        alCambiar={(valor) => alCambiar('origen', texto(valor) as OrigenPregunta | undefined)}
      />
      <Selector
        etiqueta="Dificultad asignada"
        valor={filtros.dificultad}
        opciones={deLista(opciones.dificultades)}
        alCambiar={(valor) => alCambiar('dificultad', texto(valor))}
      />
      <button
        type="button"
        className="boton filtros__limpiar"
        disabled={!hayFiltros}
        onClick={alLimpiar}
      >
        Limpiar filtros
      </button>
    </form>
  );
}
