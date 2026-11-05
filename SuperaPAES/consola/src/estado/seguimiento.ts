// C06 · Revisiones: el grupo y la página que se miran. Cambiar de pestaña vuelve a la primera página.
import { useMemo, useState } from 'react';
import { obtenerSeguimiento } from '../servicios/revision';
import type { GrupoSeguimiento } from '../tipos/seguimiento';
import { useCarga } from './carga';

export function useSeguimiento() {
  const [grupo, setGrupo] = useState<GrupoSeguimiento>('en_curso');
  const [pagina, setPagina] = useState(1);
  const cargar = useMemo(
    () => (senal: AbortSignal) => obtenerSeguimiento(grupo, pagina, senal),
    [grupo, pagina],
  );
  const elegirGrupo = (nuevo: GrupoSeguimiento) => {
    setGrupo(nuevo);
    setPagina(1);
  };
  return { carga: useCarga(cargar), grupo, elegirGrupo, irAPagina: setPagina };
}
