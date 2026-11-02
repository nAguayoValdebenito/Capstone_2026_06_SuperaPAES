// Los problemas de validación que devuelve la API en un 400 ({ ruta, mensaje } por campo), puestos bajo
// el campo de cada formulario (C03 y D01); lo que no es de un campo va arriba, en `general`.
import { ErrorApi } from '../api/cliente';
import { mensajeDeError } from './usuarios-internos';

interface DetalleApi {
  ruta: string;
  mensaje: string;
}

const esDetalle = (valor: unknown): valor is DetalleApi =>
  typeof valor === 'object' && valor !== null && 'ruta' in valor && 'mensaje' in valor;

/**
 * Cada problema bajo el campo que le da `campoDe` a su ruta (el primero de cada campo); si ninguno es de
 * un campo, como un 409, el mensaje del error va en `general`.
 */
export function erroresPorCampo<C extends string>(
  error: unknown,
  campoDe: (ruta: string) => C | undefined,
): Partial<Record<C | 'general', string>> {
  const detalles =
    error instanceof ErrorApi && Array.isArray(error.detalles)
      ? error.detalles.filter(esDetalle)
      : [];
  const errores: Partial<Record<C | 'general', string>> = {};
  for (const detalle of detalles) {
    const campo = campoDe(detalle.ruta);
    if (campo !== undefined) errores[campo] ??= detalle.mensaje;
  }
  if (Object.keys(errores).length === 0) errores.general = mensajeDeError(error).mensaje;
  return errores;
}
