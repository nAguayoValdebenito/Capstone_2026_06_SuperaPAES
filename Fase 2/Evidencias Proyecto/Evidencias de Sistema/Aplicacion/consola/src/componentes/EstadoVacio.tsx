// Estado vacío de una lista: el visto grande en gris, qué pasa y, si la hay, una salida (por ejemplo
// «Limpiar filtros»). Se anuncia como estado para el lector de pantalla.
import type { ReactNode } from 'react';

export function EstadoVacio({
  titulo,
  children,
  accion,
}: {
  titulo: string;
  /** Una explicación corta, si hace falta. */
  children?: ReactNode;
  accion?: ReactNode;
}) {
  return (
    <div className="vacio" role="status">
      <p className="vacio__titulo">{titulo}</p>
      {children && <p>{children}</p>}
      {accion}
    </div>
  );
}
