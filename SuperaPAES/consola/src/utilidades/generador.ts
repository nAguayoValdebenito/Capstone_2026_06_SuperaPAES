// Textos y cálculos de C05 · Generador con IA: traduce los códigos del lote y ubica su contenido.
import { busquedaDe } from '../estado/banco';
import type { PruebaTemario } from '../tipos';
import type { EstadoLote, Lote } from '../tipos/generador';

export const ESTADOS_LOTE: Record<EstadoLote, string> = {
  pendiente: 'En proceso',
  completado: 'Completado',
  fallido: 'Fallido',
};

const MOTIVOS: Record<string, string> = {
  formato_invalido: 'La respuesta no tenía el formato esperado',
  alternativas_incorrectas: 'Las alternativas no cumplían las reglas de la prueba',
  habilidad_invalida: 'La habilidad no es válida para la prueba',
  alternativa_repetida: 'Tenía alternativas repetidas',
  enunciado_duplicado: 'El enunciado ya estaba en el banco o en el lote',
  explicacion_larga: 'La explicación era demasiado larga',
  borrador_en_explicacion: 'La explicación tenía señales de borrador',
  clave_incoherente: 'La alternativa correcta no coincidía con la resolución',
  letras_en_explicacion: 'La explicación nombraba letras de alternativas',
  sin_tildes: 'El texto venía sin tildes',
  signos_de_interrogacion: 'Faltaban signos de interrogación',
  texto_invalido: 'El texto de lectura no era válido',
  texto_corto: 'El texto de lectura era demasiado corto',
  texto_largo: 'El texto de lectura era demasiado largo',
  IA_NO_DISPONIBLE: 'La IA no respondió',
  ERROR_AL_GUARDAR: 'No se pudo guardar la pregunta',
};

const CIERRES: Record<string, string> = {
  plazo: 'El lote se cerró porque venció su plazo.',
  saldo_agotado: 'El lote se detuvo porque se agotó el saldo de la IA.',
  ia_no_disponible: 'El lote se detuvo porque la IA dejó de responder.',
  tope_mensual: 'El lote se detuvo porque se alcanzó el tope mensual de gasto.',
  precio_no_configurado: 'El lote se detuvo porque falta el precio de un proveedor de IA.',
  contenido_inexistente: 'El lote se detuvo porque el contenido ya no existe.',
  texto_invalido: 'El lote se detuvo porque la IA no entregó un texto de lectura válido.',
};

export interface MotivoLegible {
  texto: string;
  cantidad: number;
}

/** Por qué se descartó cada pregunta o texto, sumando los motivos iguales. HU-17.3. */
export function motivosLegibles({ motivos }: Lote): MotivoLegible[] {
  const grupos = [motivos?.porMotivo, motivos?.fallas, motivos?.textos];
  const suma = new Map<string, number>();
  for (const [codigo, cantidad] of grupos.flatMap((grupo) => Object.entries(grupo ?? {}))) {
    const texto = MOTIVOS[codigo] ?? 'Otro motivo';
    suma.set(texto, (suma.get(texto) ?? 0) + cantidad);
  }
  return [...suma].map(([texto, cantidad]) => ({ texto, cantidad }));
}

/** La razón del cierre, si no terminó de forma normal. */
export function notaDeCierre({ motivos }: Lote): string | null {
  return motivos?.cierre ? (CIERRES[motivos.cierre] ?? null) : null;
}

/** La prueba, el eje y el contenido de un lote, para mostrar su nombre y filtrar el banco. */
export function ubicarContenido(pruebas: readonly PruebaTemario[], contenidoId: number) {
  for (const prueba of pruebas) {
    for (const eje of prueba.ejes) {
      const contenido = eje.contenidos.find(({ id }) => id === contenidoId);
      if (contenido) return { prueba, eje, contenido };
    }
  }
  return null;
}

/** El banco filtrado en los borradores de IA de ese contenido (RF-G03). */
export function enlaceAlBanco(pruebas: readonly PruebaTemario[], lote: Lote): string {
  const lugar = ubicarContenido(pruebas, lote.contenidoId);
  const filtros = {
    ...(lugar && { prueba: lugar.prueba.id, eje: lugar.eje.id, contenido: lugar.contenido.id }),
    estado: 'borrador',
    origen: 'ia' as const,
  };
  return `/banco?${busquedaDe(filtros, 1).toString()}`;
}

const formatoFecha = new Intl.DateTimeFormat('es-CL', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'America/Santiago',
});

export const fechaDeLote = (creadoEn: string) => formatoFecha.format(new Date(creadoEn));

export const hayPendientes = (lotes: readonly Lote[]) =>
  lotes.some(({ estado }) => estado === 'pendiente');

export const CANTIDAD_MAXIMA = 10;
export const CANTIDAD_MINIMA_CON_TEXTO = 3;

export interface CamposLote {
  pruebaId?: number | undefined;
  ejeId?: number | undefined;
  contenidoId?: number | undefined;
  cantidad: string;
  conTexto: boolean;
}

/** El primer problema del formulario, antes de llamar a la API (CU-17 pasos 1 y 1.b). */
export function errorDelPedido({ contenidoId, cantidad, conTexto }: CamposLote): string | null {
  if (contenidoId === undefined) return 'Elige la prueba, el eje y el contenido.';
  const numero = Number(cantidad);
  if (!Number.isInteger(numero) || numero < 1 || numero > CANTIDAD_MAXIMA) {
    return `La cantidad debe ser de 1 a ${String(CANTIDAD_MAXIMA)} preguntas.`;
  }
  if (conTexto && numero < CANTIDAD_MINIMA_CON_TEXTO) {
    return `Con texto de lectura debes pedir al menos ${String(CANTIDAD_MINIMA_CON_TEXTO)} preguntas.`;
  }
  return null;
}
