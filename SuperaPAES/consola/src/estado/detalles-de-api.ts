// Los problemas de validación que devuelve la API en un 400 ({ ruta, mensaje } por campo), para que cada
// formulario los ponga bajo su campo (C03 y D01).
import { ErrorApi } from '../api/cliente';

export interface DetalleApi {
  ruta: string;
  mensaje: string;
}

const esDetalle = (valor: unknown): valor is DetalleApi =>
  typeof valor === 'object' && valor !== null && 'ruta' in valor && 'mensaje' in valor;

/** Los problemas por campo del error, o ninguno si no es un error de la API con detalles. */
export function detallesDeApi(error: unknown): DetalleApi[] {
  return error instanceof ErrorApi && Array.isArray(error.detalles)
    ? error.detalles.filter(esDetalle)
    : [];
}
