import type { PlanAdministrable } from '../../tipos/planes';

interface Propiedades {
  planes: PlanAdministrable[];
  seleccionado: number | undefined;
  guardando: boolean;
  alEditar: (plan: PlanAdministrable) => void;
}

function FilaPlan({
  plan,
  seleccionado,
  guardando,
  alEditar,
}: Omit<Propiedades, 'planes'> & { plan: PlanAdministrable }) {
  return (
    <tr key={plan.id} className={seleccionado === plan.id ? 'planes__seleccionado' : ''}>
      <th scope="row">{plan.nombre}</th>
      <td>{plan.alcance.nombre}</td>
      <td>{plan.periodicidad.nombre}</td>
      <td>
        {new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(
          plan.precioClp,
        )}
      </td>
      <td>{plan.productos.google_play || 'Sin configurar'}</td>
      <td>{plan.productos.app_store || 'Sin configurar'}</td>
      <td>
        <span className={`planes__estado ${plan.activo ? 'planes__estado--activo' : ''}`}>
          {plan.activo ? 'Activo' : 'Desactivado'}
        </span>
      </td>
      <td>
        <button
          type="button"
          className="boton"
          disabled={guardando}
          aria-label={`Editar ${plan.nombre}`}
          aria-pressed={seleccionado === plan.id}
          onClick={() => alEditar(plan)}
        >
          Editar
        </button>
      </td>
    </tr>
  );
}

export function TablaPlanes({ planes, seleccionado, guardando, alEditar }: Propiedades) {
  if (planes.length === 0) return <p>No hay planes configurados.</p>;
  return (
    <div className="tabla-desplazable" role="region" aria-label="Planes configurados" tabIndex={0}>
      <table className="tabla planes__tabla">
        <thead>
          <tr>
            {[
              'Plan',
              'Alcance',
              'Periodicidad',
              'Precio (CLP)',
              'Producto Google Play',
              'Producto App Store',
              'Estado',
              'Acción',
            ].map((titulo) => (
              <th scope="col" key={titulo}>
                {titulo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {planes.map((plan) => (
            <FilaPlan
              key={plan.id}
              plan={plan}
              seleccionado={seleccionado}
              guardando={guardando}
              alEditar={alEditar}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
