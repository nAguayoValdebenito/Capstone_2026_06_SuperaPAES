// Lo que se ve de una carga de la API (estado/carga.ts): el aviso de que carga, el error con su código o
// lo que se dibuja con los datos. Una página pública puede mostrar su propio texto de error en lugar del
// de la API.
import type { ReactNode } from 'react';
import type { Carga } from '../estado/carga';
import { Alerta } from './Alerta';

export function SegunCarga<T>({
  carga,
  cargando,
  fallida,
  children,
}: {
  carga: Carga<T>;
  cargando: string;
  /** El texto del error, si no se muestra el de la API. */
  fallida?: string;
  children: (datos: T) => ReactNode;
}) {
  if (carga.tipo === 'cargando') return <p aria-live="polite">{cargando}</p>;
  if (carga.tipo === 'fallida') {
    return fallida ? (
      <Alerta texto={fallida} />
    ) : (
      <Alerta texto={carga.mensaje} codigo={carga.codigo} />
    );
  }
  return children(carga.datos);
}
