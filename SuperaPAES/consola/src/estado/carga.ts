// Carga de datos de la API para una página: cargando, lista o fallida. Vuelve a cargar cuando cambia la
// función (memorizada por quien la usa, con sus datos); mientras llega la nueva, está cargando. Cancela
// la carga anterior y la del desmontaje. Con null no carga nada.
import { useEffect, useState } from 'react';
import { mensajeDeError } from './usuarios-internos';

export type Carga<T> =
  | { tipo: 'cargando' }
  | { tipo: 'lista'; datos: T }
  | { tipo: 'fallida'; codigo: string; mensaje: string };

export function useCarga<T>(
  cargar: ((senal: AbortSignal) => Promise<T>) | null,
  version = 0,
): Carga<T> {
  const [resultado, setResultado] = useState<{
    de: unknown;
    version: number;
    carga: Carga<T>;
  } | null>(null);
  useEffect(() => {
    if (!cargar) return;
    const control = new AbortController();
    cargar(control.signal).then(
      (datos) => {
        if (!control.signal.aborted)
          setResultado({ de: cargar, version, carga: { tipo: 'lista', datos } });
      },
      (error: unknown) => {
        if (control.signal.aborted) return;
        setResultado({ de: cargar, version, carga: { tipo: 'fallida', ...mensajeDeError(error) } });
      },
    );
    return () => control.abort();
  }, [cargar, version]);
  return resultado?.de === cargar && resultado.version === version
    ? resultado.carga
    : { tipo: 'cargando' };
}
