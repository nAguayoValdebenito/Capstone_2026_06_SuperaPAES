// La sección Tablas de conversión de C08: las tablas de la prueba, cuál está vigente y la carga de una nueva
// (CU-31 pasos 5 y 6, RN-23).
import { EncabezadoTabla } from '../../componentes/EncabezadoTabla';
import { SegunCarga } from '../../componentes/SegunCarga';
import { useTablas } from '../../estado/evaluaciones';
import type { TablaConversion } from '../../tipos/evaluaciones';
import { FormularioTabla } from './FormularioTabla';

const COLUMNAS = ['Año', 'Proceso', 'Electivo', 'Publicada', 'Filas', 'Estado'];

function Fila({ tabla }: { tabla: TablaConversion }) {
  return (
    <tr>
      <th scope="row">{tabla.anioAdmision}</th>
      <td>{tabla.proceso}</td>
      <td>{tabla.electivo ?? '—'}</td>
      <td>{tabla.publicadaEn}</td>
      <td>{tabla.filas}</td>
      <td>
        {tabla.vigente ? <span className="etiqueta etiqueta--activa">Vigente</span> : 'Anterior'}
      </td>
    </tr>
  );
}

export function PanelTablas({ pruebaId }: { pruebaId: number }) {
  const { carga, guardarTabla, guardando, error, aviso } = useTablas(pruebaId);
  return (
    <>
      {aviso && (
        <p className="estado__ok" role="status">
          {aviso}
        </p>
      )}
      <SegunCarga carga={carga} cargando="Cargando las tablas…">
        {({ tablas, procesos, electivos }) => (
          <>
            {tablas.length > 0 ? (
              <div className="tabla-desplazable">
                <table className="tabla">
                  <EncabezadoTabla columnas={COLUMNAS} />
                  <tbody>
                    {tablas.map((tabla) => (
                      <Fila key={tabla.id} tabla={tabla} />
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p>Esta prueba aún no tiene tabla: el ensayo completo se muestra sin puntaje.</p>
            )}
            <FormularioTabla
              pruebaId={pruebaId}
              procesos={procesos}
              electivos={electivos}
              guardando={guardando}
              error={error}
              alGuardar={guardarTabla}
            />
          </>
        )}
      </SegunCarga>
    </>
  );
}
