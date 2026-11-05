import { usePlanes } from '../../estado/planes';
import { FormularioPlan } from './FormularioPlan';
import { TablaPlanes } from './TablaPlanes';
import './planes.css';

function NotasPlanes() {
  return (
    <aside className="planes__notas" aria-label="Información de los planes">
      <p>
        Antes de guardar, configura el producto con el mismo identificador y precio en Google Play y
        en la App Store. Cada plan y periodicidad tiene su propio producto. En Google Play, cada
        producto tiene un solo plan base.
      </p>
      <p>
        El plan Gratis no se cobra. Sus beneficios dependen del cupo diario, las preguntas extra y
        los usos gratis de cada evaluación.
      </p>
      <p>Un plan desactivado deja de ofrecerse a estudiantes nuevos.</p>
    </aside>
  );
}

export function PaginaPlanes() {
  const { carga, plan, seleccionar, guardar, guardando, aviso, reintentar } = usePlanes();
  return (
    <section className="pagina pagina--ancha planes">
      <h1>Planes</h1>
      <p className="pagina__aviso">
        Los precios deben coincidir con los configurados en cada tienda.
      </p>
      {carga.tipo === 'cargando' && <p role="status">Cargando planes…</p>}
      {carga.tipo === 'fallida' && (
        <div>
          <p className="estado__error" role="alert">
            {carga.mensaje}
          </p>
          <button type="button" className="boton" onClick={reintentar}>
            Reintentar
          </button>
        </div>
      )}
      {aviso && (
        <p className="estado__ok" role="status">
          {aviso}
        </p>
      )}
      {carga.tipo === 'lista' && (
        <>
          <TablaPlanes
            planes={carga.datos.planes}
            seleccionado={plan?.id}
            guardando={guardando}
            alEditar={seleccionar}
          />
          <div className="planes__detalle">
            {plan && (
              <FormularioPlan
                key={plan.id}
                plan={plan}
                opciones={carga.datos}
                guardando={guardando}
                alGuardar={guardar}
                alCancelar={() => seleccionar(null)}
              />
            )}
            <NotasPlanes />
          </div>
        </>
      )}
    </section>
  );
}
