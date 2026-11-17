// Filtros del banco (C02, HU-11 esc. 1, RF-G01): prueba, eje y contenido en cascada, habilidad de la
// prueba, estado, origen y dificultad asignada. Prueba y estado quedan a la vista; los demás, en «Más
// filtros (n)», que empieza abierto si alguno está activo (estado/mas-filtros-banco.ts). Los selectores
// plegados siguen dibujados (el contenedor lleva hidden). Solo presenta: los cambios los aplica useBanco.
import { useId } from 'react';
import { contenidosDisponibles, ejesDisponibles, habilidadesDisponibles } from '../../estado/banco';
import { useMasFiltros } from '../../estado/mas-filtros-banco';
import { Selector } from '../../componentes/Selector';
import { deLista, deTemario, numero } from '../../utilidades/opciones';
import type { FiltrosBanco as Filtros, OpcionesFiltrosBanco, OrigenPregunta } from '../../tipos';

interface Propiedades {
  opciones: OpcionesFiltrosBanco;
  filtros: Filtros;
  alCambiar: <C extends keyof Filtros>(campo: C, valor: Filtros[C] | undefined) => void;
  alLimpiar: () => void;
}

const texto = (valor: string) => (valor === '' ? undefined : valor);

function FiltrosTemario({ opciones, filtros, alCambiar }: Omit<Propiedades, 'alLimpiar'>) {
  const ejes = ejesDisponibles(opciones.pruebas, filtros);
  const contenidos = contenidosDisponibles(opciones.pruebas, filtros);
  const habilidades = habilidadesDisponibles(opciones.pruebas, filtros);
  return (
    <>
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

/** Los filtros plegados: eje, contenido, habilidad, origen y dificultad asignada. */
function FiltrosDeMas({
  id,
  oculto,
  opciones,
  filtros,
  alCambiar,
}: Omit<Propiedades, 'alLimpiar'> & { id: string; oculto: boolean }) {
  return (
    <div id={id} className="filtros__mas" hidden={oculto}>
      <FiltrosTemario opciones={opciones} filtros={filtros} alCambiar={alCambiar} />
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
    </div>
  );
}

export function FiltrosBanco({ opciones, filtros, alCambiar, alLimpiar }: Propiedades) {
  const hayFiltros = Object.keys(filtros).length > 0;
  const idMas = useId();
  const mas = useMasFiltros(filtros);
  return (
    <form className="filtros" aria-label="Filtros del banco" onSubmit={(e) => e.preventDefault()}>
      <Selector
        etiqueta="Prueba"
        valor={filtros.prueba}
        opciones={opciones.pruebas.map((p) => ({ valor: String(p.id), texto: p.nombre }))}
        alCambiar={(valor) => alCambiar('prueba', numero(valor))}
      />
      <Selector
        etiqueta="Estado"
        valor={filtros.estado}
        opciones={deLista(opciones.estados)}
        alCambiar={(valor) => alCambiar('estado', texto(valor))}
      />
      <div className="banco__botones-filtros">
        <button
          type="button"
          className="boton banco__mas-filtros"
          aria-expanded={mas.abierto}
          aria-controls={idMas}
          onClick={mas.alternar}
        >
          {`Más filtros (${String(mas.activos)})`}
        </button>
        <button
          type="button"
          className="boton filtros__limpiar"
          disabled={!hayFiltros}
          onClick={alLimpiar}
        >
          Limpiar filtros
        </button>
      </div>
      <FiltrosDeMas
        id={idMas}
        oculto={!mas.abierto}
        opciones={opciones}
        filtros={filtros}
        alCambiar={alCambiar}
      />
    </form>
  );
}
