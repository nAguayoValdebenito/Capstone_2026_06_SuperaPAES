import type { FiltrosTemario as Filtros } from '../../estado/temario';
import type { ConsultaTemario } from '../../tipos/temario';

function Selector({
  etiqueta,
  vacio,
  valor,
  opciones,
  alElegir,
}: {
  etiqueta: string;
  vacio: string;
  valor: number | null;
  opciones: { id: number; nombre: string }[];
  alElegir: (valor: number | null) => void;
}) {
  return (
    <label className="campo">
      {etiqueta}
      <select value={valor ?? ''} onChange={(e) => alElegir(Number(e.target.value) || null)}>
        <option value="">{vacio}</option>
        {opciones.map((o) => (
          <option key={o.id} value={o.id}>
            {o.nombre}
          </option>
        ))}
      </select>
    </label>
  );
}

export function FiltrosTemario({
  datos,
  filtros,
  alFiltrar,
  alLimpiar,
}: {
  datos: ConsultaTemario;
  filtros: Filtros;
  alFiltrar: (cambios: Partial<Filtros>) => void;
  alLimpiar: () => void;
}) {
  return (
    <div className="temario__filtros" role="search" aria-label="Buscar en el temario">
      <Selector
        etiqueta="Prueba"
        vacio="Todas las pruebas"
        valor={filtros.pruebaId}
        opciones={datos.pruebas.map((p) => ({ id: p.id, nombre: `${p.codigo} · ${p.nombre}` }))}
        alElegir={(pruebaId) => alFiltrar({ pruebaId })}
      />
      <Selector
        etiqueta="Área"
        vacio="Todas las áreas"
        valor={filtros.areaId}
        opciones={datos.areas}
        alElegir={(areaId) => alFiltrar({ areaId })}
      />
      <label className="campo temario__busqueda">
        Buscar
        <input
          type="search"
          value={filtros.texto}
          maxLength={200}
          placeholder="Eje, contenido, habilidad o descriptor"
          onChange={(e) => alFiltrar({ texto: e.target.value })}
        />
      </label>
      <button className="boton" type="button" onClick={alLimpiar}>
        Limpiar filtros
      </button>
    </div>
  );
}
