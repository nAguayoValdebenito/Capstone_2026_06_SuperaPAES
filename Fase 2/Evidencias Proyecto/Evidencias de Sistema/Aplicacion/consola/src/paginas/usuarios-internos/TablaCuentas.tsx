// Tabla de cuentas internas de C10: nombre, correo, rol, áreas de especialidad y estado. La fila de la
// cuenta abierta en el formulario queda marcada (aria-current).
import { EstadoVacio } from '../../componentes/EstadoVacio';
import type { Area, CuentaInterna } from '../../tipos';
import { NOMBRE_ROL } from './textos';

interface Propiedades {
  cuentas: readonly CuentaInterna[];
  areas: readonly Area[];
  alEditar: (cuenta: CuentaInterna) => void;
  alAlternarEstado: (cuenta: CuentaInterna) => void;
  /** Cuenta de la sesión: no se ofrece desactivarla (CU-23 3.c). */
  idPropio: string | undefined;
  /** Cuenta abierta en el formulario de edición. */
  idEditando?: string | undefined;
}

function nombresDeAreas(ids: readonly number[], areas: readonly Area[]): string {
  const nombres = ids.map((id) => areas.find((a) => a.id === id)?.nombre ?? `Área ${id}`);
  return nombres.length > 0 ? nombres.join(', ') : '—';
}

function Fila({
  cuenta,
  areas,
  alEditar,
  alAlternarEstado,
  idPropio,
  idEditando,
}: Omit<Propiedades, 'cuentas'> & { cuenta: CuentaInterna }) {
  return (
    <tr aria-current={cuenta.id === idEditando ? 'true' : undefined}>
      <td>{cuenta.nombre}</td>
      <td>{cuenta.correo}</td>
      <td>{NOMBRE_ROL[cuenta.rol]}</td>
      <td>{nombresDeAreas(cuenta.areas, areas)}</td>
      <td>
        <span className={`etiqueta etiqueta--${cuenta.activo ? 'activa' : 'inactiva'}`}>
          {cuenta.activo ? 'Activa' : 'Desactivada'}
        </span>
      </td>
      <td>
        <div className="tabla__acciones">
          <button type="button" className="boton boton--chico" onClick={() => alEditar(cuenta)}>
            Editar
          </button>
          {(cuenta.id !== idPropio || !cuenta.activo) && (
            <button
              type="button"
              className={`boton boton--chico${cuenta.activo ? ' boton--peligro' : ''}`}
              onClick={() => alAlternarEstado(cuenta)}
            >
              {cuenta.activo ? 'Desactivar' : 'Activar'}
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

export function TablaCuentas({ cuentas, ...resto }: Propiedades) {
  if (cuentas.length === 0) return <EstadoVacio titulo="Todavía no hay usuarios internos." />;
  return (
    <div className="tabla-desplazable">
      <table className="tabla">
        <thead>
          <tr>
            <th scope="col">Nombre</th>
            <th scope="col">Correo</th>
            <th scope="col">Rol</th>
            <th scope="col">Áreas de especialidad</th>
            <th scope="col">Estado</th>
            <th scope="col">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {cuentas.map((cuenta) => (
            <Fila key={cuenta.id} cuenta={cuenta} {...resto} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
