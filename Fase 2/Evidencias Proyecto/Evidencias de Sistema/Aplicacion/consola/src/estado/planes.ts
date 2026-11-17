import { useEffect, useRef, useState } from 'react';
import { editarPlan, listarPlanes } from '../servicios/planes';
import type { DatosPlanes, EdicionPlan, PlanAdministrable } from '../tipos/planes';
import { mensajeDeError } from './usuarios-internos';

export type CargaPlanes =
  | { tipo: 'cargando' }
  | { tipo: 'fallida'; mensaje: string }
  | { tipo: 'lista'; datos: DatosPlanes };

function useCargaPlanes(version: number) {
  const [carga, setCarga] = useState<CargaPlanes>({ tipo: 'cargando' });
  useEffect(() => {
    const control = new AbortController();
    listarPlanes(control.signal).then(
      (datos) => {
        if (!control.signal.aborted) setCarga({ tipo: 'lista', datos });
      },
      (error: unknown) => {
        if (!control.signal.aborted) setCarga({ tipo: 'fallida', ...mensajeDeError(error) });
      },
    );
    return () => control.abort();
  }, [version]);
  return { carga, setCarga };
}

export function usePlanes() {
  const [version, setVersion] = useState(0);
  const { carga, setCarga } = useCargaPlanes(version);
  const [plan, seleccionar] = useState<PlanAdministrable | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState('');
  const enCurso = useRef(false);
  const guardar = async (datos: EdicionPlan) => {
    if (!plan || enCurso.current) return;
    enCurso.current = true;
    setGuardando(true);
    setAviso('');
    try {
      const actualizado = await editarPlan(plan.id, datos);
      setCarga((actual) =>
        actual.tipo === 'lista'
          ? {
              ...actual,
              datos: {
                ...actual.datos,
                planes: actual.datos.planes.map((p) => (p.id === actualizado.id ? actualizado : p)),
              },
            }
          : actual,
      );
      seleccionar(null);
      setAviso('Plan guardado. El cambio quedó registrado en la auditoría.');
    } finally {
      enCurso.current = false;
      setGuardando(false);
    }
  };
  const reintentar = () => {
    setCarga({ tipo: 'cargando' });
    setVersion((v) => v + 1);
  };
  return { carga, plan, seleccionar, guardar, guardando, aviso, reintentar };
}
