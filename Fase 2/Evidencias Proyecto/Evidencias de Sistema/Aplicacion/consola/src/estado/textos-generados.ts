import { useCallback, useState } from 'react';
import { obtenerLecturasDelLote } from '../servicios/textos-generados';
import { useCarga } from './carga';

/** Al cambiar de lote se cancela la lectura anterior y se ocultan sus datos. */
export function useTextosGenerados(loteId: string) {
  const [version, setVersion] = useState(0);
  const cargar = useCallback(
    (senal: AbortSignal) => obtenerLecturasDelLote(loteId, senal),
    [loteId],
  );
  return { carga: useCarga(cargar, version), reintentar: () => setVersion((actual) => actual + 1) };
}
