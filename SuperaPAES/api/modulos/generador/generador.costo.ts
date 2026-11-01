// Costo de las llamadas a la IA (RNF-03). Los precios son dólares por millón de tokens y salen de
// contenido.configuracion, por proveedor. Si falta el precio de un proveedor, o no es un número positivo,
// no se calcula nada: falla de forma segura (PRECIO_IA_NO_CONFIGURADO) y nunca como si costara cero.
import type { ProveedorIAReal } from '../../adaptadores/ia/proveedor.js';
import { ErrorPrecioIaNoConfigurado } from '../../comun/errores.js';
import type { AdministracionServicio } from '../administracion/index.js';

export interface PrecioPorMillon {
  entrada: number;
  salida: number;
}

export type Precios = Partial<Record<ProveedorIAReal, PrecioPorMillon>>;

type LectorDeParametros = Pick<AdministracionServicio, 'obtenerParametroNumero'>;

async function precioDe(parametros: LectorDeParametros, clave: string): Promise<number> {
  let valor: number;
  try {
    valor = await parametros.obtenerParametroNumero(clave);
  } catch {
    throw new ErrorPrecioIaNoConfigurado();
  }
  if (!(valor > 0)) throw new ErrorPrecioIaNoConfigurado();
  return valor;
}

/** Los precios de cada proveedor que se usará; si falta alguno, ErrorPrecioIaNoConfigurado. */
export async function leerPrecios(
  parametros: LectorDeParametros,
  proveedores: readonly ProveedorIAReal[],
): Promise<Precios> {
  const precios: Precios = {};
  for (const proveedor of proveedores) {
    precios[proveedor] = {
      entrada: await precioDe(parametros, `precio_entrada_ia_${proveedor}`),
      salida: await precioDe(parametros, `precio_salida_ia_${proveedor}`),
    };
  }
  return precios;
}

const DECIMALES_DEL_COSTO = 10_000;

/**
 * El costo en dólares de una llamada, redondeado hacia arriba a 4 decimales (la columna lo admite). Con
 * solo el total de tokens, se cobra todo al precio más alto: nunca se subestima. Sin conteo de tokens no
 * se puede calcular y devuelve null.
 */
function calcularCostoUsd(
  uso: { entrada?: number; salida?: number; total?: number } | undefined,
  precio: PrecioPorMillon,
): number | null {
  if (uso === undefined) return null;
  let dolares: number;
  if (uso.entrada !== undefined && uso.salida !== undefined) {
    dolares = (uso.entrada * precio.entrada + uso.salida * precio.salida) / 1_000_000;
  } else if (uso.total !== undefined) {
    dolares = (uso.total * Math.max(precio.entrada, precio.salida)) / 1_000_000;
  } else {
    return null;
  }
  return Math.ceil(dolares * DECIMALES_DEL_COSTO - 1e-9) / DECIMALES_DEL_COSTO;
}
