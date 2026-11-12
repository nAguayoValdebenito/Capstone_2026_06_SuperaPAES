import { useRef, useState } from 'react';
import type { ParametroConfiguracion } from '../tipos/configuracion';
import { validarEntradaConfiguracion } from './configuracion-validacion';

export interface ConfirmacionConfiguracion {
  parametro: ParametroConfiguracion;
  valor: number;
}

function sinBorrador(actual: Record<string, string>, clave: string): Record<string, string> {
  const siguiente = { ...actual };
  delete siguiente[clave];
  return siguiente;
}

export function useEdicionConfiguracion() {
  const [borradores, setBorradores] = useState<Record<string, string>>({});
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [confirmacion, setConfirmacion] = useState<ConfirmacionConfiguracion | null>(null);
  const disparador = useRef<HTMLButtonElement | null>(null);

  const cambiarBorrador = (clave: string, texto: string) => {
    setBorradores((actual) => ({ ...actual, [clave]: texto }));
    setErrores((actual) => ({ ...actual, [clave]: '' }));
  };
  const abrirConfirmacion = (parametro: ParametroConfiguracion, boton: HTMLButtonElement) => {
    const texto = borradores[parametro.clave] ?? String(parametro.valor);
    const resultado = validarEntradaConfiguracion(parametro.clave, texto);
    if (resultado.valor === undefined) {
      setErrores((actual) => ({
        ...actual,
        [parametro.clave]: resultado.error ?? 'Valor inválido.',
      }));
      return;
    }
    if (resultado.valor === parametro.valor) {
      setErrores((actual) => ({ ...actual, [parametro.clave]: 'No hay cambios por guardar.' }));
      return;
    }
    disparador.current = boton;
    setConfirmacion({ parametro, valor: resultado.valor });
  };
  const finalizar = () => {
    setConfirmacion(null);
    requestAnimationFrame(() => disparador.current?.focus());
  };
  const limpiarBorrador = (clave: string) => {
    setBorradores((actual) => sinBorrador(actual, clave));
  };
  const marcarError = (clave: string, texto: string) => {
    setErrores((actual) => ({ ...actual, [clave]: texto }));
  };
  return {
    borradores,
    errores,
    confirmacion,
    cambiarBorrador,
    abrirConfirmacion,
    cerrarConfirmacion: finalizar,
    finalizar,
    limpiarBorrador,
    marcarError,
  };
}
