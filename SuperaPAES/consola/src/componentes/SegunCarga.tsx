// Lo que se ve de una carga de la API (estado/carga.ts): el aviso de que carga, el error con su código o
// lo que se dibuja con los datos.
import type { ReactNode } from 'react';
import type { Carga } from '../estado/carga';
import { Alerta } from './Alerta';

export function SegunCarga<T>({
  carga,
  cargando,
  children,
}: {
  carga: Carga<T>;
  cargando: string;
  children: (datos: T) => ReactNode;
}) {
  if (carga.tipo === 'cargando') return <p aria-live="polite">{cargando}</p>;
  if (carga.tipo === 'fallida') return <Alerta texto={carga.mensaje} codigo={carga.codigo} />;
  return children(carga.datos);
}
