import { useRef, useState } from 'react';
import { ErrorApi } from '../api/cliente';
import { cambiarConfiguracion } from '../servicios/configuracion';
import type { useEdicionConfiguracion } from './configuracion-edicion';
import { mensajeDeError } from './usuarios-internos';

interface Aviso {
  tipo: 'exito' | 'error';
  texto: string;
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
      await cambiarConfiguracion(seleccion.parametro, seleccion.valor);
      edicion.limpiarBorrador(seleccion.parametro.clave);
      setAviso({ tipo: 'exito', texto: 'Parámetro guardado y cambio registrado.' });
      recargar();
    } catch (error) {
      const esConflicto = error instanceof ErrorApi && error.codigo === 'CONFLICTO';
      if (esConflicto) edicion.limpiarBorrador(seleccion.parametro.clave);
      if (error instanceof ErrorApi && error.codigo === 'VALIDACION')
        edicion.marcarError(seleccion.parametro.clave, error.message);
      setAviso({
        tipo: 'error',
        texto: esConflicto
          ? 'Otro administrador cambió este parámetro. Se está cargando el valor vigente.'
          : mensajeDeError(error).mensaje,
      });
      if (esConflicto) recargar();
    } finally {
      enCurso.current = false;
      setGuardando(false);
      edicion.finalizar();
    }
  };
  return { guardando, aviso, confirmarCambio, limpiarAviso: () => setAviso(null) };
}
