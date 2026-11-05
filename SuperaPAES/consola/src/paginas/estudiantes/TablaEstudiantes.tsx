// Resultado de la búsqueda de C15. Solo una cuenta sin verificar se puede confirmar (CU-02b).
import { EncabezadoTabla } from '../../componentes/EncabezadoTabla';
import type { EstudianteConsola } from '../../tipos/estudiantes';
import { fechaLimite } from '../../utilidades/revision';

const COLUMNAS = ['Correo', 'Nombre', 'Registro', 'Correo verificado', 'Acción'];

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
      <table className="tabla">
        <EncabezadoTabla columnas={COLUMNAS} />
        <tbody>
          {estudiantes.map((estudiante) => (
            <tr key={estudiante.id}>
              <th scope="row">{estudiante.correo}</th>
              <td>{estudiante.nombre}</td>
              <td>{fechaLimite(estudiante.creadoEn)}</td>
              <td>{estudiante.correoVerificado ? 'Sí' : 'No'}</td>
              <td>
                {estudiante.correoVerificado ? (
                  '—'
                ) : (
                  <button
                    type="button"
                    className="boton"
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
