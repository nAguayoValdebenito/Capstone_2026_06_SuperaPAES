// Lo que el lote anota en contenido.lote_generacion.motivos_descarte (HU-17.1, decisión de cierre del lote):
// cuántas preguntas descartó cada regla, qué fallas tuvo la IA y por qué se cerró el lote. Son funciones
// puras: cada una devuelve el JSON nuevo sin cambiar el anterior.
import type { Problema } from './generador.revision.js';

export type CierreDeLote =
  | 'completo'
  | 'plazo'
  | 'saldo_agotado'
  | 'ia_no_disponible'
  | 'tope_mensual'
  | 'precio_no_configurado'
  | 'contenido_inexistente'
  | 'texto_invalido';

export interface MotivosDelLote {
  /** El primer problema de cada pregunta descartada (su motivo de descarte). */
  porMotivo: Record<string, number>;
  /** Cuántas veces saltó cada regla; una pregunta puede romper varias. */
  reglas: Record<string, number>;
  /** Llamadas a la IA que fallaron (cuentan como pregunta descartada): IA_NO_DISPONIBLE y otras. */
  fallas: Record<string, number>;
  /** Solo en lotes con texto de lectura: por qué se descartó cada texto pedido (HU-18.2). */
  textos?: Record<string, number>;
  cierre?: CierreDeLote;
}

const esRegistro = (valor: unknown): valor is Record<string, unknown> =>
  typeof valor === 'object' && valor !== null && !Array.isArray(valor);

function contadores(valor: unknown): Record<string, number> {
  if (!esRegistro(valor)) return {};
  return Object.fromEntries(
    Object.entries(valor).filter(
      (par): par is [string, number] => typeof par[1] === 'number' && par[1] > 0,
    ),
  );
}

/** Lee el JSON guardado; un lote nuevo (null) o un valor raro parte de cero. */
export function leerMotivos(valor: unknown): MotivosDelLote {
  const origen = esRegistro(valor) ? valor : {};
  const textos = contadores(origen['textos']);
  return {
    porMotivo: contadores(origen['porMotivo']),
    reglas: contadores(origen['reglas']),
    fallas: contadores(origen['fallas']),
    ...(Object.keys(textos).length > 0 && { textos }),
  };
}

const sumar = (cuentas: Record<string, number>, clave: string): Record<string, number> => ({
  ...cuentas,
  [clave]: (cuentas[clave] ?? 0) + 1,
});

/** Anota una pregunta descartada con todos los problemas que se le encontraron (el primero es su motivo). */
export function anotarDescarte(
  motivos: MotivosDelLote,
  problemas: readonly Problema[],
): MotivosDelLote {
  let reglas = motivos.reglas;
  for (const problema of problemas) reglas = sumar(reglas, problema.motivo);
  const primero = problemas[0]?.motivo ?? 'sin_motivo';
  return { ...motivos, porMotivo: sumar(motivos.porMotivo, primero), reglas };
}

/** Anota un texto de lectura descartado con todos los problemas que se le encontraron. */
export function anotarTextoDescartado(
  motivos: MotivosDelLote,
  problemas: readonly Problema[],
): MotivosDelLote {
  let textos = motivos.textos ?? {};
  for (const problema of problemas) textos = sumar(textos, problema.motivo);
  return { ...motivos, textos };
}

export function anotarFalla(motivos: MotivosDelLote, codigo: string): MotivosDelLote {
  return { ...motivos, fallas: sumar(motivos.fallas, codigo) };
}

export const anotarCierre = (motivos: MotivosDelLote, cierre: CierreDeLote): MotivosDelLote => ({
  ...motivos,
  cierre,
});
