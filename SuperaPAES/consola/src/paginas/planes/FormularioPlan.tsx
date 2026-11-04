import { useFormularioPlan } from '../../estado/formulario-plan';
import type { DatosPlanes, EdicionPlan, OpcionPlan, PlanAdministrable } from '../../tipos/planes';

interface Propiedades {
  plan: PlanAdministrable;
  opciones: DatosPlanes;
  guardando: boolean;
  alGuardar: (datos: EdicionPlan) => Promise<void>;
  alCancelar: () => void;
}

function Selector({
  nombre,
  opciones,
  valor,
  cambiar,
}: {
  nombre: string;
  opciones: OpcionPlan[];
  valor: number;
  cambiar: (id: number) => void;
}) {
  return (
    <label className="campo">
      {nombre}
      <select value={valor} onChange={(e) => cambiar(Number(e.target.value))} required>
        {opciones.map((opcion) => (
          <option key={opcion.id} value={opcion.id}>
            {opcion.nombre}
          </option>
        ))}
      </select>
    </label>
  );
}

function CamposProductos({ formulario }: { formulario: ReturnType<typeof useFormularioPlan> }) {
  const { campos, cambiar } = formulario;
  return (
    <>
      {(['google_play', 'app_store'] as const).map((tienda) => (
        <label className="campo" key={tienda}>
          {tienda === 'google_play' ? 'Producto en Google Play' : 'Producto en la App Store'}
          <input
            required
            maxLength={100}
            value={campos.productos[tienda]}
            onChange={(e) =>
              cambiar({ productos: { ...campos.productos, [tienda]: e.target.value } })
            }
          />
        </label>
      ))}
    </>
  );
}

function CamposDatos({
  formulario,
  opciones,
}: {
  formulario: ReturnType<typeof useFormularioPlan>;
  opciones: DatosPlanes;
}) {
  const { campos, cambiar } = formulario;
  return (
    <>
      <label className="campo">
        Nombre
        <input
          required
          maxLength={60}
          value={campos.nombre}
          onChange={(e) => cambiar({ nombre: e.target.value })}
        />
      </label>
      <Selector
        nombre="Alcance"
        opciones={opciones.alcances}
        valor={campos.alcanceId}
        cambiar={(alcanceId) => cambiar({ alcanceId })}
      />
      <Selector
        nombre="Periodicidad"
        opciones={opciones.periodicidades}
        valor={campos.periodicidadId}
        cambiar={(periodicidadId) => cambiar({ periodicidadId })}
      />
      <label className="campo">
        Precio (CLP)
        <input
          required
          type="number"
          min={1}
          step={1}
          value={Number.isNaN(campos.precioClp) ? '' : campos.precioClp}
          onChange={(e) => cambiar({ precioClp: e.target.valueAsNumber })}
        />
      </label>
    </>
  );
}

export function FormularioPlan({ plan, opciones, guardando, alGuardar, alCancelar }: Propiedades) {
  const formulario = useFormularioPlan(plan, alGuardar);
  const { campos, cambiar, enviar, error } = formulario;
  return (
    <form
      className="panel panel--ancho planes__formulario"
      onSubmit={enviar}
      aria-labelledby="editar-plan"
    >
      <h2 id="editar-plan">Editar plan: {plan.nombre}</h2>
      {error && (
        <p className="estado__error" role="alert">
          {error}
        </p>
      )}
      <fieldset disabled={guardando} className="planes__campos">
        <legend>Datos del plan</legend>
        <CamposDatos formulario={formulario} opciones={opciones} />
        <CamposProductos formulario={formulario} />
        <label className="campo">
          Estado
          <select
            value={String(campos.activo)}
            onChange={(e) => cambiar({ activo: e.target.value === 'true' })}
          >
            <option value="true">Activo</option>
            <option value="false">Desactivado</option>
          </select>
        </label>
        <div className="panel__acciones planes__acciones">
          <button className="boton" type="button" onClick={alCancelar}>
            Cancelar
          </button>
          <button className="boton boton--primario" type="submit">
            {guardando ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </fieldset>
    </form>
  );
}
