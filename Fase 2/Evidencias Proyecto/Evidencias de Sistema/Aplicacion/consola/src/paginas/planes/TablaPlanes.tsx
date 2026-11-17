import { EstadoVacio } from '../../componentes/EstadoVacio';
import type { PlanAdministrable } from '../../tipos/planes';

interface Propiedades {
  planes: PlanAdministrable[];
  seleccionado: number | undefined;
  guardando: boolean;
  alEditar: (plan: PlanAdministrable) => void;
}

/** El identificador del producto en la tienda va en letra de datos; si falta, se dice en texto. */
function Producto({ identificador }: { identificador: string }) {
  if (!identificador) return <span className="planes__sin-producto">Sin configurar</span>;
  return <span className="tabla__id planes__producto">{identificador}</span>;
}

function FilaPlan({
  plan,
  seleccionado,
  guardando,
  alEditar,
}: Omit<Propiedades, 'planes'> & { plan: PlanAdministrable }) {
  return (
    <tr key={plan.id} aria-current={seleccionado === plan.id ? 'true' : undefined}>
      <th scope="row">{plan.nombre}</th>
      <td>{plan.alcance.nombre}</td>
      <td>{plan.periodicidad.nombre}</td>
      <td className="tabla__numero">
        {new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(
          plan.precioClp,
        )}
      </td>
      <td>
        <Producto identificador={plan.productos.google_play} />
      </td>
      <td>
        <Producto identificador={plan.productos.app_store} />
      </td>
      <td>
        <span className={`etiqueta ${plan.activo ? 'etiqueta--activa' : 'etiqueta--inactiva'}`}>
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
  if (planes.length === 0) return <EstadoVacio titulo="No hay planes configurados." />;
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
