import { useState } from 'react';
import { listarConfiguracion } from '../servicios/configuracion';
import { useCarga } from './carga';
import { useEdicionConfiguracion } from './configuracion-edicion';
import { useGuardadoConfiguracion } from './configuracion-guardado';

export function useConfiguracion() {
  const [version, setVersion] = useState(0);
  const carga = useCarga(listarConfiguracion, version);
  const edicion = useEdicionConfiguracion();
  const recargar = () => setVersion((actual) => actual + 1);
  const guardado = useGuardadoConfiguracion(edicion, recargar);
  const cambiarBorrador = (clave: string, texto: string) => {
    edicion.cambiarBorrador(clave, texto);
    guardado.limpiarAviso();
  };
  return {
    carga,
    borradores: edicion.borradores,
    errores: edicion.errores,
    confirmacion: edicion.confirmacion,
    guardando: guardado.guardando,
    aviso: guardado.aviso,
    cambiarBorrador,
    abrirConfirmacion: edicion.abrirConfirmacion,
    cerrarConfirmacion: edicion.cerrarConfirmacion,
    confirmarCambio: guardado.confirmarCambio,
    reintentar: recargar,
  };
}
