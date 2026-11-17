// «Requiere atención» del Panel (C01): lo primero que ve el administrador, una lista de lo que le toca
// hacer hoy, con la marca de cada asunto y un enlace a su sección. Usa los mismos contadores que el menú y
// la campana; si no hay nada pendiente, lo dice con el visto en gris.
import { Link } from 'react-router';
import { asuntosPendientes } from '../../estado/asuntos-pendientes';
import { useContadoresMenu } from '../../estado/contadores-menu';
import { esSesionProvisional, useSesion } from '../../estado/contexto-sesion';

export function RequiereAtencion() {
  const { usuario } = useSesion();
  const contadores = useContadoresMenu(usuario?.rol ?? null, !esSesionProvisional(usuario));
  const lista = asuntosPendientes(contadores);
  return (
    <section className="atencion" aria-labelledby="atencion-titulo">
      <h2 id="atencion-titulo">Requiere atención</h2>
      {lista.length === 0 ? (
        <p className="atencion__nada">Nada pendiente por ahora.</p>
      ) : (
        <ul className="atencion__lista">
          {lista.map(({ ruta, texto, seccion, alerta }) => (
            <li key={ruta}>
              <span className={`etiqueta etiqueta--${alerta ? 'atencion' : 'pendiente'}`}>
                {alerta ? 'Pide acción' : 'Pendiente'}
              </span>
              <span>{texto}</span>
              <Link to={ruta} className="atencion__enlace">
                Abrir {seccion}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
