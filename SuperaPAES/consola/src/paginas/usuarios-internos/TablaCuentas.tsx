// Tabla de cuentas internas de C10: nombre, correo, rol, áreas de especialidad y estado.
import type { Area, CuentaInterna } from '../../tipos';
import { NOMBRE_ROL } from './textos';

interface Propiedades {
  cuentas: readonly CuentaInterna[];
  areas: readonly Area[];
  alEditar: (cuenta: CuentaInterna) => void;
  alAlternarEstado: (cuenta: CuentaInterna) => void;
}

function nombresDeAreas(ids: readonly number[], areas: readonly Area[]): string {
  const nombres = ids.map((id) => areas.find((a) => a.id === id)?.nombre ?? `Área ${id}`);
  return nombres.length > 0 ? nombres.join(', ') : '—';
}

export function TablaCuentas({ cuentas, areas, alEditar, alAlternarEstado }: Propiedades) {
  if (cuentas.length === 0) return <p>Todavía no hay usuarios internos.</p>;
  return (
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
          <tr key={cuenta.id}>
            <td>{cuenta.nombre}</td>
            <td>{cuenta.correo}</td>
            <td>{NOMBRE_ROL[cuenta.rol]}</td>
            <td>{nombresDeAreas(cuenta.areas, areas)}</td>
            <td className={cuenta.activo ? 'estado__ok' : 'estado__error'}>
              {cuenta.activo ? 'Activa' : 'Desactivada'}
            </td>
            <td className="tabla__acciones">
              <button type="button" className="boton" onClick={() => alEditar(cuenta)}>
                Editar
              </button>
              <button type="button" className="boton" onClick={() => alAlternarEstado(cuenta)}>
                {cuenta.activo ? 'Desactivar' : 'Activar'}
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
