// Estado de la API y de la base de datos, al final del Panel. Cada servicio lleva su marca (visto o cruz),
// sin pulsos ni animaciones.
import { useSaludSistema } from '../../estado/salud-sistema';

export function EstadoDelSistema() {
  const consulta = useSaludSistema();
  return (
    <section className="panel-inicio__sistema" aria-label="Estado del sistema">
      <h2>Estado del sistema</h2>
      {consulta.tipo === 'cargando' && (
        <p className="cargando" aria-live="polite">
          Consultando la API…
        </p>
      )}
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
    </section>
  );
}
