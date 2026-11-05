// C08 · Evaluaciones: carga las estructuras y las tablas de la prueba elegida, y vuelve a leerlas al guardar.
import { useCallback, useState } from 'react';
import {
  cargarTabla,
  editarEstructura,
  listarEstructuras,
  listarTablas,
} from '../servicios/evaluaciones';
import type { EdicionEstructura, NuevaTabla } from '../tipos/evaluaciones';
import { useCarga } from './carga';
import { mensajeDeError } from './usuarios-internos';

/** Guardar con su estado: evita el doble envío y deja el motivo si la API lo rechaza. */
function useGuardado() {
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const guardar = async (accion: () => Promise<unknown>): Promise<boolean> => {
    if (guardando) return false;
    setGuardando(true);
    setError(null);
    try {
      await accion();
      return true;
    } catch (causa) {
      setError(mensajeDeError(causa).mensaje);
      return false;
    } finally {
      setGuardando(false);
    }
  };
  return { guardando, error, guardar, limpiarError: () => setError(null) };
}

export function useEstructuras(pruebaId: number) {
  const [version, setVersion] = useState(0);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const { guardando, error, guardar, limpiarError } = useGuardado();
  const cargar = useCallback(
    (senal: AbortSignal) => listarEstructuras(pruebaId, senal),
    [pruebaId],
  );
  const carga = useCarga(cargar, version);

  const editar = (id: number | null) => {
    setEditandoId(id);
    setAviso(null);
    limpiarError();
  };

  const guardarEstructura = async (id: number, datos: EdicionEstructura) => {
    if (await guardar(() => editarEstructura(id, datos))) {
      setEditandoId(null);
      setAviso('Estructura guardada. Vale para las evaluaciones siguientes.');
      setVersion((v) => v + 1);
    }
  };

  return { carga, editandoId, editar, guardarEstructura, guardando, error, aviso };
}

export function useTablas(pruebaId: number) {
  const [version, setVersion] = useState(0);
  const [aviso, setAviso] = useState<string | null>(null);
  const { guardando, error, guardar } = useGuardado();
  const cargar = useCallback((senal: AbortSignal) => listarTablas(pruebaId, senal), [pruebaId]);
  const carga = useCarga(cargar, version);

  const guardarTabla = async (datos: NuevaTabla) => {
    setAviso(null);
    const guardada = await guardar(() => cargarTabla(datos));
    if (guardada) {
      setAviso('Tabla cargada. Los ensayos completos siguientes usan la más reciente.');
      setVersion((v) => v + 1);
    }
    return guardada;
  };

  return { carga, guardarTabla, guardando, error, aviso };
}
