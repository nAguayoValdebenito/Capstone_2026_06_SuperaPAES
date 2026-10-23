// Usuarios internos (C10): carga las cuentas y las áreas, abre el panel de crear o editar y activa o
// desactiva una cuenta. Cancela la carga al desmontar.
import { useCallback, useEffect, useState } from 'react';
import { ErrorApi } from '../api/cliente';
import { cambiarEstadoUsuarioInterno, listarUsuariosInternos } from '../servicios/administracion';
import { listarAreas } from '../servicios/temario';
import type { Area, CuentaInterna } from '../tipos';

export type CargaUsuariosInternos =
  | { tipo: 'cargando' }
  | { tipo: 'lista'; cuentas: CuentaInterna[]; areas: Area[] }
  | { tipo: 'fallida'; codigo: string; mensaje: string };

/** Panel abierto: crear una cuenta nueva o editar una existente. */
export type PanelCuenta = { modo: 'crear' } | { modo: 'editar'; cuenta: CuentaInterna } | null;

export function mensajeDeError(error: unknown): { codigo: string; mensaje: string } {
  return error instanceof ErrorApi
    ? { codigo: error.codigo, mensaje: error.message }
    : { codigo: 'ERROR_INESPERADO', mensaje: 'Ocurrió un error inesperado.' };
}

function useCarga(version: number): CargaUsuariosInternos {
  const [carga, setCarga] = useState<CargaUsuariosInternos>({ tipo: 'cargando' });
  useEffect(() => {
    const control = new AbortController();
    Promise.all([listarUsuariosInternos(control.signal), listarAreas(control.signal)]).then(
      ([cuentas, areas]) => setCarga({ tipo: 'lista', cuentas, areas }),
      (error: unknown) => {
        if (!control.signal.aborted) setCarga({ tipo: 'fallida', ...mensajeDeError(error) });
      },
    );
    return () => control.abort();
  }, [version]);
  return carga;
}

export function useUsuariosInternos() {
  const [version, setVersion] = useState(0);
  const carga = useCarga(version);
  const [panel, setPanel] = useState<PanelCuenta>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const recargar = useCallback(() => setVersion((v) => v + 1), []);

  const alternarEstado = useCallback(
    (cuenta: CuentaInterna) => {
      setAviso(null);
      cambiarEstadoUsuarioInterno(cuenta.id, !cuenta.activo).then(recargar, (error: unknown) =>
        setAviso(mensajeDeError(error).mensaje),
      );
    },
    [recargar],
  );

  const alGuardar = useCallback(() => {
    setPanel(null);
    recargar();
  }, [recargar]);

  return { carga, panel, abrirPanel: setPanel, alGuardar, alternarEstado, aviso };
}
