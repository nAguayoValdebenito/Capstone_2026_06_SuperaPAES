import { useRef, useState } from 'react';
import type { ParametroConfiguracion } from '../tipos/configuracion';
import { validarEntradaConfiguracion } from './configuracion-validacion';

export interface ConfirmacionConfiguracion {
  parametro: ParametroConfiguracion;
  valor: number;
}

export function prepararCambioConfiguracion(
  parametro: ParametroConfiguracion,
  texto: string,
):
  | { tipo: 'invalido'; mensaje: string }
  | { tipo: 'listo'; confirmacion: ConfirmacionConfiguracion } {
  const resultado = validarEntradaConfiguracion(parametro.clave, texto);
  if (resultado.valor === undefined)
    return { tipo: 'invalido', mensaje: resultado.error ?? 'Valor inválido.' };
  if (resultado.valor === parametro.valor)
    return { tipo: 'invalido', mensaje: 'No hay cambios por guardar.' };
  return { tipo: 'listo', confirmacion: { parametro, valor: resultado.valor } };
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
    const preparacion = prepararCambioConfiguracion(parametro, texto);
    if (preparacion.tipo === 'invalido') {
      setErrores((actual) => ({ ...actual, [parametro.clave]: preparacion.mensaje }));
      return;
    }
    disparador.current = boton;
    setConfirmacion(preparacion.confirmacion);
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
