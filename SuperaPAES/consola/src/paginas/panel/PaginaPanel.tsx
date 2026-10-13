// Panel del administrador. Por ahora muestra el estado de la API y de la base de datos.
import { EnConstruccion } from '../../componentes/EnConstruccion';
import { useSaludSistema } from '../../estado/salud-sistema';

export function PaginaPanel() {
  const consulta = useSaludSistema();

  return (
    <EnConstruccion titulo="Panel">
      <h2>Estado del sistema</h2>
      {consulta.tipo === 'cargando' && <p aria-live="polite">Consultando la API…</p>}
      {consulta.tipo === 'lista' && (
        <dl className="estado">
          <dt>API</dt>
          <dd className="estado__ok">{consulta.salud.estado}</dd>
          <dt>Base de datos</dt>
          <dd className="estado__ok">{consulta.salud.baseDeDatos}</dd>
        </dl>
      )}
      {consulta.tipo === 'fallida' && (
        <p className="estado__error" role="alert">
          {consulta.mensaje} <span className="estado__codigo">({consulta.codigo})</span>
        </p>
      )}
    </EnConstruccion>
  );
}
