import { useRef, useState } from 'react';
import { ErrorApi } from '../api/cliente';
import { cambiarConfiguracion } from '../servicios/configuracion';
import type { ConfirmacionConfiguracion, useEdicionConfiguracion } from './configuracion-edicion';
import { mensajeDeError } from './usuarios-internos';

interface Aviso {
  tipo: 'exito' | 'error';
  texto: string;
}

interface AccionesGuardado {
  cambiar: typeof cambiarConfiguracion;
  limpiarBorrador: (clave: string) => void;
  marcarError: (clave: string, texto: string) => void;
  avisar: (aviso: Aviso) => void;
  recargar: () => void;
}

export async function ejecutarGuardadoConfiguracion(
  seleccion: ConfirmacionConfiguracion,
  acciones: AccionesGuardado,
): Promise<void> {
  const clave = seleccion.parametro.clave;
  try {
    await acciones.cambiar(seleccion.parametro, seleccion.valor);
    acciones.limpiarBorrador(clave);
    acciones.avisar({ tipo: 'exito', texto: 'Parámetro guardado y cambio registrado.' });
    acciones.recargar();
  } catch (error) {
    const esConflicto = error instanceof ErrorApi && error.codigo === 'CONFLICTO';
    if (esConflicto) acciones.limpiarBorrador(clave);
    if (error instanceof ErrorApi && error.codigo === 'VALIDACION')
      acciones.marcarError(clave, error.message);
    acciones.avisar({
      tipo: 'error',
      texto: esConflicto
        ? 'Otro administrador cambió este parámetro. Se está cargando el valor vigente.'
        : mensajeDeError(error).mensaje,
    });
    if (esConflicto) acciones.recargar();
  }
}

export function useGuardadoConfiguracion(
  edicion: ReturnType<typeof useEdicionConfiguracion>,
  recargar: () => void,
) {
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const enCurso = useRef(false);
  const confirmarCambio = async () => {
    const seleccion = edicion.confirmacion;
    if (!seleccion || enCurso.current) return;
    enCurso.current = true;
    setGuardando(true);
    setAviso(null);
    try {
      await ejecutarGuardadoConfiguracion(seleccion, {
        cambiar: cambiarConfiguracion,
        limpiarBorrador: edicion.limpiarBorrador,
        marcarError: edicion.marcarError,
        avisar: setAviso,
        recargar,
      });
    } finally {
      enCurso.current = false;
      setGuardando(false);
      edicion.finalizar();
    }
  };
  return { guardando, aviso, confirmarCambio, limpiarAviso: () => setAviso(null) };
}
