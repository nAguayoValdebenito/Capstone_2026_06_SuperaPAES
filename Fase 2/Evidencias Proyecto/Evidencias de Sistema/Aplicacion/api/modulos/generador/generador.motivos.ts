// Lo que el lote anota en contenido.lote_generacion.motivos_descarte (HU-17.1, decisión de cierre del lote):
// cuántas preguntas descartó cada regla, qué fallas tuvo la IA y por qué se cerró el lote. Son funciones
// puras: cada una devuelve el JSON nuevo sin cambiar el anterior.
import type { Ficha } from './generador.fichas.js';
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

/**
 * Una pregunta descartada, para la tabla del lote (C05, HU-17.3). Sale de la ficha, que arma el servidor: nunca
 * lleva el texto que devolvió el modelo (HU-16.5).
 */
export interface DescarteDePregunta {
  orden: number;
  habilidad: string;
  dificultad: string;
  motivo: string;
}

type FichaDescartada = Pick<Ficha, 'orden' | 'habilidad' | 'dificultad'>;

export interface MotivosDelLote {
  /** El primer problema de cada pregunta descartada (su motivo de descarte). */
  porMotivo: Record<string, number>;
  /** Cuántas veces saltó cada regla; una pregunta puede romper varias. */
  reglas: Record<string, number>;
  /** Llamadas a la IA que fallaron (cuentan como pregunta descartada): IA_NO_DISPONIBLE y otras. */
  fallas: Record<string, number>;
  /** Solo en lotes con texto de lectura: por qué se descartó cada texto pedido (HU-18.2). */
  textos?: Record<string, number>;
  /** Cada pregunta descartada con su motivo, en el orden en que se revisaron. */
  detalle?: DescarteDePregunta[];
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

function esDescarte(valor: unknown): valor is DescarteDePregunta {
  if (!esRegistro(valor)) return false;
  return (
    typeof valor['orden'] === 'number' &&
    typeof valor['habilidad'] === 'string' &&
    typeof valor['dificultad'] === 'string' &&
    typeof valor['motivo'] === 'string'
  );
}

/** Los descartes guardados en el JSON; un lote antiguo no los tiene. */
export function leerDetalle(valor: unknown): DescarteDePregunta[] {
  const detalle = esRegistro(valor) ? valor['detalle'] : undefined;
  return Array.isArray(detalle) ? detalle.filter(esDescarte) : [];
}

/** Lee el JSON guardado; un lote nuevo (null) o un valor raro parte de cero. */
export function leerMotivos(valor: unknown): MotivosDelLote {
  const origen = esRegistro(valor) ? valor : {};
  const textos = contadores(origen['textos']);
  const detalle = leerDetalle(origen);
  return {
    porMotivo: contadores(origen['porMotivo']),
    reglas: contadores(origen['reglas']),
    fallas: contadores(origen['fallas']),
    ...(Object.keys(textos).length > 0 && { textos }),
    ...(detalle.length > 0 && { detalle }),
  };
}

const sumar = (cuentas: Record<string, number>, clave: string): Record<string, number> => ({
  ...cuentas,
  [clave]: (cuentas[clave] ?? 0) + 1,
});

/** Agrega la pregunta descartada al detalle, si se sabe cuál fue. */
function conDetalle(
  motivos: MotivosDelLote,
  motivo: string,
  ficha: FichaDescartada | undefined,
): MotivosDelLote {
  if (!ficha) return motivos;
  const { orden, habilidad, dificultad } = ficha;
  const nuevo = { orden, habilidad: habilidad.nombre, dificultad, motivo };
  return { ...motivos, detalle: [...(motivos.detalle ?? []), nuevo] };
}

/** Anota una pregunta descartada con todos los problemas que se le encontraron (el primero es su motivo). */
export function anotarDescarte(
  motivos: MotivosDelLote,
  problemas: readonly Problema[],
  ficha?: FichaDescartada,
): MotivosDelLote {
  let reglas = motivos.reglas;
  for (const problema of problemas) reglas = sumar(reglas, problema.motivo);
  const primero = problemas[0]?.motivo ?? 'sin_motivo';
  return {
    ...conDetalle(motivos, primero, ficha),
    porMotivo: sumar(motivos.porMotivo, primero),
    reglas,
  };
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

export function anotarFalla(
  motivos: MotivosDelLote,
  codigo: string,
  ficha?: FichaDescartada,
): MotivosDelLote {
  return { ...conDetalle(motivos, codigo, ficha), fallas: sumar(motivos.fallas, codigo) };
}

export const anotarCierre = (motivos: MotivosDelLote, cierre: CierreDeLote): MotivosDelLote => ({
  ...motivos,
  cierre,
});
