// Filtros de las suscripciones (C16, HU-56 esc. 2): estado (RN-26), plan, fechas de creación y correo
// del estudiante. El correo se busca al apretar Enter o «Buscar», no en cada letra. Solo presenta: los
// cambios los aplica useSuscripciones.
import { type FormEvent, useState } from 'react';
import { Selector } from '../../componentes/Selector';
import type { AccionesSuscripciones } from '../../estado/suscripciones';
import type {
  FiltrosSuscripciones as Filtros,
  ResumenSuscripciones,
} from '../../tipos/suscripciones';
import { deLista, deTemario, numero } from '../../utilidades/opciones';

interface Propiedades {
  opciones: Pick<ResumenSuscripciones, 'estados' | 'planes'>;
  filtros: Filtros;
  acciones: Pick<AccionesSuscripciones, 'cambiarFiltro' | 'limpiarFiltros'>;
}

function BuscarCorreo({ filtros, acciones }: Omit<Propiedades, 'opciones'>) {
  const [correo, setCorreo] = useState(filtros.correo ?? '');
  const buscar = (evento: FormEvent) => {
    evento.preventDefault();
    acciones.cambiarFiltro('correo', correo.trim());
  };
  return (
    <form className="filtros__busqueda" role="search" onSubmit={buscar}>
      <label className="campo">
        Correo del estudiante
        <input
          type="search"
          value={correo}
          maxLength={150}
          placeholder="Buscar"
          onChange={(evento) => setCorreo(evento.target.value)}
        />
      </label>
      <button type="submit" className="boton">
        Buscar
      </button>
    </form>
  );
}

export function FiltrosSuscripciones({ opciones, filtros, acciones }: Propiedades) {
  const fecha = (campo: 'desde' | 'hasta', etiqueta: string) => (
    <label className="campo">
      {etiqueta}
      <input
        type="date"
        value={filtros[campo] ?? ''}
        min={campo === 'hasta' ? filtros.desde : undefined}
        max={campo === 'desde' ? filtros.hasta : undefined}
        onChange={(evento) => acciones.cambiarFiltro(campo, evento.target.value)}
      />
    </label>
  );
  return (
    <div className="filtros">
      <Selector
        etiqueta="Estado"
        valor={filtros.estado}
        opciones={deLista(opciones.estados)}
        alCambiar={(valor) => acciones.cambiarFiltro('estado', valor)}
      />
      <Selector
        etiqueta="Plan"
        valor={filtros.plan}
        opciones={deTemario(opciones.planes)}
        alCambiar={(valor) => acciones.cambiarFiltro('plan', numero(valor))}
      />
      {fecha('desde', 'Desde')}
      {fecha('hasta', 'Hasta')}
      <BuscarCorreo key={filtros.correo ?? ''} filtros={filtros} acciones={acciones} />
      <button type="button" className="boton filtros__limpiar" onClick={acciones.limpiarFiltros}>
        Limpiar filtros
      </button>
    </div>
  );
}
