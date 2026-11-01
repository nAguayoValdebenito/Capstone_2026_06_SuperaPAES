// El turno de un lote (HU-16.2): arma lo que hace falta para trabajarlo, las fichas de las preguntas que
// faltan y la llamada a la IA de cada una. No guarda nada: eso lo hace generador.avance.ts.
import type { SolicitudGeneracion } from '../../adaptadores/ia/proveedor.js';
import {
  ErrorIANoDisponible,
  ErrorIARespuestaInvalida,
  ErrorIASaldoAgotado,
  ErrorPrecioIaNoConfigurado,
} from '../../comun/errores.js';
import { leerPrecios, type Precios } from './generador.costo.js';
import { armarFichas, type Ficha } from './generador.fichas.js';
import { construirInstruccion, contextosDe, esNumerica } from './generador.instrucciones.js';
import type { FilaLote } from './generador.lotes.repositorio.js';
import type { CierreDeLote } from './generador.motivos.js';
import { construirInstruccionTexto, temaDeTexto, tipoDeTextoDe } from './generador.texto.js';
import type { DependenciasProcesador, Intento, Turno } from './generador.procesador.tipos.js';

const EJEMPLOS_POR_PREGUNTA = 3;
export const CONCURRENCIA_MAXIMA = 5;

export const azarDe = (d: DependenciasProcesador): (() => number) =>
  d.opciones?.aleatorio ?? Math.random;

async function numeroOpcional(d: DependenciasProcesador, clave: string): Promise<number | null> {
  try {
    return await d.administracion.obtenerParametroNumero(clave);
  } catch {
    return null;
  }
}

async function temperaturas(d: DependenciasProcesador): Promise<Turno['temperaturas']> {
  const resultado: Turno['temperaturas'] = {};
  for (const proveedor of d.ia.usa) {
    const valor = await numeroOpcional(d, `temperatura_ia_${proveedor}`);
    if (valor !== null) resultado[proveedor] = valor;
  }
  return resultado;
}

async function preciosOCierre(d: DependenciasProcesador): Promise<Precios | CierreDeLote> {
  try {
    return await leerPrecios(d.administracion, d.ia.usa);
  } catch (error) {
    if (error instanceof ErrorPrecioIaNoConfigurado) return 'precio_no_configurado';
    throw error;
  }
}

/** Arma el turno, o dice por qué el lote no se puede trabajar (y se cierra sin llamar a la IA). */
export async function prepararTurno(
  d: DependenciasProcesador,
  lote: FilaLote,
  plazoMs: number,
): Promise<Turno | CierreDeLote> {
  const contenido = await d.temario.contenidoParaGenerar(lote.contenidoId);
  if (!contenido?.activo) return 'contenido_inexistente';
  const precios = await preciosOCierre(d);
  if (typeof precios === 'string') return precios;
  const concurrencia = Math.round((await numeroOpcional(d, 'concurrencia_ia')) ?? 1);
  return {
    lote,
    contenido,
    precios,
    temperaturas: await temperaturas(d),
    maximoMensual: await d.administracion.obtenerParametroNumero('tope_mensual_ia_usd'),
    concurrencia: Math.min(Math.max(concurrencia, 1), CONCURRENCIA_MAXIMA),
    limiteMs: d.reloj().getTime() + plazoMs,
    existentes: await d.preguntas.enunciadosDelContenido(lote.contenidoId),
    ejemplos: await d.preguntas.ejemplosAprobados(lote.contenidoId, EJEMPLOS_POR_PREGUNTA),
    mezcla: await d.temario.mezclaDeDificultad(),
    fallasSeguidas: 0,
  };
}

/** Las fichas de las preguntas que faltan: lo pedido menos lo que ya se hizo (reanudación del lote). */
export function fichasQueFaltan(d: DependenciasProcesador, turno: Turno): Ficha[] {
  const { lote, contenido } = turno;
  const prueba = contenido.prueba;
  return armarFichas({
    cantidad: Math.max(lote.cantidad - lote.validas - lote.descartadas, 0),
    nombreContenido: contenido.nombre,
    descriptores: contenido.descriptores,
    habilidades: prueba.habilidades,
    mezcla: turno.mezcla,
    contextos: contextosDe(prueba.codigo),
    numerica: esNumerica(prueba.codigo),
    usarResultadoObjetivo: d.opciones?.usarResultadoObjetivo ?? true,
    aleatorio: azarDe(d),
  });
}

const FALLAS_DE_LA_IA = [
  [ErrorIASaldoAgotado, 'IA_SALDO_AGOTADO'],
  [ErrorIANoDisponible, 'IA_NO_DISPONIBLE'],
  [ErrorIARespuestaInvalida, 'IA_RESPUESTA_INVALIDA'],
] as const;

/** Una falla conocida de la IA se anota; cualquier otro error es inesperado y se deja subir. */
function comoFalla(error: unknown): Intento | null {
  for (const [clase, codigo] of FALLAS_DE_LA_IA) {
    if (error instanceof clase) {
      return { tipo: 'falla', codigo, saldoAgotado: codigo === 'IA_SALDO_AGOTADO' };
    }
  }
  return null;
}

function solicitudDe(turno: Turno, ficha: Ficha): SolicitudGeneracion {
  const { contenido } = turno;
  const prueba = contenido.prueba;
  return {
    instruccion: construirInstruccion({
      prueba,
      eje: contenido.eje.nombre,
      contenido: contenido.nombre,
      curso: contenido.curso,
      ficha,
      alternativas: prueba.opcionesMax,
      ejemplos: turno.ejemplos,
      enunciadosPrevios: turno.existentes,
      ...(turno.texto && { texto: turno.texto }),
    }),
    formato: {
      alternativas: prueba.opcionesMax,
      habilidades: prueba.habilidades.map((h) => h.codigo),
    },
    temperaturas: turno.temperaturas,
  };
}

async function llamar(d: DependenciasProcesador, solicitud: SolicitudGeneracion): Promise<Intento> {
  try {
    return { tipo: 'respuesta', resultado: await d.ia.generarPreguntas(solicitud) };
  } catch (error) {
    const falla = comoFalla(error);
    if (falla) return falla;
    throw error;
  }
}

/** Pide a la IA la pregunta de una ficha; las fallas conocidas vuelven como dato, las demás suben. */
export const pedirPropuesta = (d: DependenciasProcesador, turno: Turno, ficha: Ficha) =>
  llamar(d, solicitudDe(turno, ficha));

/** Pide a la IA el texto de lectura del lote (HU-18.1), de un tema sorteado y del tipo que dice el eje. */
export function pedirTexto(d: DependenciasProcesador, turno: Turno): Promise<Intento> {
  const { contenido } = turno;
  return llamar(d, {
    instruccion: construirInstruccionTexto({
      prueba: contenido.prueba,
      eje: contenido.eje.nombre,
      contenido: contenido.nombre,
      curso: contenido.curso,
      tema: temaDeTexto(azarDe(d)),
      tipo: tipoDeTextoDe(contenido.eje.nombre),
    }),
    salida: 'texto',
    temperaturas: turno.temperaturas,
  });
}

/** Antes de cada llamada: el plazo del turno y el tope mensual de gasto (RNF-03), con lo ya gastado. */
export async function motivoParaParar(
  d: DependenciasProcesador,
  turno: Turno,
): Promise<CierreDeLote | null> {
  const ahora = d.reloj();
  if (ahora.getTime() >= turno.limiteMs) return 'plazo';
  const { gastado, sinCosto } = await d.lotes.gastoMensual(ahora);
  if (sinCosto) return 'precio_no_configurado';
  return gastado >= turno.maximoMensual ? 'tope_mensual' : null;
}
