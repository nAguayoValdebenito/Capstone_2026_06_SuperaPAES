// Tabla de C15: una fila por estudiante con su suscripción vigente y sus intereses. Solo una cuenta sin
// verificar se puede confirmar (CU-02b).
import { EncabezadoTabla } from '../../componentes/EncabezadoTabla';
import type { EstudianteConsola } from '../../tipos/estudiantes';

const COLUMNAS = ['Nombre completo', 'Correo electrónico', 'Suscripción', 'Intereses', 'Cuenta'];

function Suscripcion({ activa }: { activa: boolean }) {
  return activa ? (
    <span className="etiqueta etiqueta--activa">Activa</span>
  ) : (
    <span className="tabla__secundario">Sin suscripción activa</span>
  );
}

export function TablaEstudiantes({
  estudiantes,
  confirmando,
  alConfirmar,
}: {
  estudiantes: readonly EstudianteConsola[];
  confirmando: number | null;
  alConfirmar: (id: number) => void;
}) {
  return (
    <div className="tabla-desplazable">
      <table className="tabla estudiantes__tabla">
        <EncabezadoTabla columnas={COLUMNAS} />
        <tbody>
          {estudiantes.map((estudiante) => (
            <tr key={estudiante.id}>
              <th scope="row">{estudiante.nombre}</th>
              <td className="estudiantes__correo">{estudiante.correo}</td>
              <td>
                <Suscripcion activa={estudiante.suscripcionActiva} />
              </td>
              <td>
                {estudiante.intereses.length > 0 ? (
                  estudiante.intereses.join(', ')
                ) : (
                  <span className="tabla__secundario">Sin intereses registrados</span>
                )}
              </td>
              <td>
                {estudiante.correoVerificado ? (
                  <span className="etiqueta etiqueta--vigente">Verificada</span>
                ) : (
                  <button
                    type="button"
                    className="boton boton--chico"
                    aria-busy={confirmando === estudiante.id ? true : undefined}
                    disabled={confirmando !== null}
                    onClick={() => alConfirmar(estudiante.id)}
                  >
                    {confirmando === estudiante.id ? 'Confirmando…' : 'Confirmar cuenta'}
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
