import { useState } from 'react';
import { Link } from 'react-router';
import { SegunCarga } from '../../componentes/SegunCarga';
import { useTarifas } from '../../estado/saldo';
import { ConsultaSaldo } from './ConsultaSaldo';
import { FormularioTarifa } from './FormularioTarifa';

export function PaginaRemuneracion() {
  const estado = useTarifas();
  const [docente, setDocente] = useState<number | null>(null);
  return (
    <section className="pagina pagina--ancha">
      <h1>Remuneración docente</h1>
      <p className="pagina__aviso">
        Administra la tarifa y consulta lo acumulado por cada docente.
      </p>
      <p>
        Los límites de preguntas pendientes y revisiones diarias se administran en{' '}
        <Link to="/configuracion">Configuración</Link>.
      </p>
      {estado.aviso && <p role={estado.aviso.error ? 'alert' : 'status'}>{estado.aviso.texto}</p>}
      <SegunCarga carga={estado.carga} cargando="Cargando tarifas y docentes...">
        {({ tarifas, docentes }) => (
          <>
            <FormularioTarifa
              tarifas={tarifas}
              guardar={estado.guardar}
              guardando={estado.guardando}
            />
            <label className="campo saldo__docente">
              Docente
              <select
                value={docente ?? ''}
                onChange={(e) => setDocente(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">Selecciona un docente</option>
                {docentes.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.nombre}
                  </option>
                ))}
              </select>
            </label>
            {docentes.length === 0 && <p>No hay docentes registrados.</p>}
            {docente !== null && <ConsultaSaldo key={docente} docenteId={docente} />}
          </>
        )}
      </SegunCarga>
      {estado.carga.tipo === 'fallida' && (
        <button className="boton" onClick={estado.reintentar}>
          Reintentar
        </button>
      )}
    </section>
  );
}
