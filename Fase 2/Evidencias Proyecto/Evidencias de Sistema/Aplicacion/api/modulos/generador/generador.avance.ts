// El avance de un lote (HU-16.2, HU-17): cada resultado de la IA se guarda en su propia transacción junto con
// los conteos, los tokens, el costo y los motivos del lote. Si el proceso muere, lo ya hecho queda guardado y
// el siguiente turno sigue desde ahí. Una llamada ya pagada se anota siempre, aunque la pregunta no se pueda guardar.
import type { PreguntaPropuesta, ResultadoGeneracion } from '../../adaptadores/ia/proveedor.js';
import { claseDeError, registro } from '../../comun/registro.js';
import type { Ejecutor } from '../../db/transaccion.js';
import type { PropuestaDeIa } from '../preguntas/index.js';
import { calcularCostoUsd, type Precios } from './generador.costo.js';
import type { Ficha } from './generador.fichas.js';
import { esNumerica } from './generador.instrucciones.js';
import type { AvanceDeLote } from './generador.lotes.repositorio.js';
import {
  anotarDescarte,
  anotarFalla,
  leerMotivos,
  type CierreDeLote,
  type MotivosDelLote,
} from './generador.motivos.js';
import type { DependenciasProcesador, FallaDeLaIa, Turno } from './generador.procesador.tipos.js';
import { aPropuestaGuardable } from './generador.propuesta.js';
import { revisarPropuesta, type Problema } from './generador.revision.js';
import { azarDe } from './generador.turno.js';

/** Errores seguidos de la IA tras los cuales se deja de insistir. */
export const FALLAS_SEGUIDAS_PARA_CORTAR = 3;

type Anotacion = (motivos: MotivosDelLote) => MotivosDelLote;
type ConsumoDeLaLlamada = Pick<AvanceDeLote, 'tokens' | 'costoUsd' | 'modelo'>;

/** Lo que se guarda de golpe: los conteos, el consumo, cómo se anotan los motivos y, si hay, qué escribir antes. */
export type CambioDeLote = Pick<AvanceDeLote, 'validas' | 'descartadas'> &
  ConsumoDeLaLlamada & { anotar: Anotacion; antes?: (tx: Ejecutor) => Promise<void> };

const SIN_CONSUMO: ConsumoDeLaLlamada = { tokens: null, costoUsd: null, modelo: null };

/**
 * Suma un avance al lote y, en la misma transacción, lo que haga `antes` (guardar la pregunta). Con la fila
 * reservada, los motivos se leen y se escriben sin que otro proceso se cuele.
 */
export async function guardarAvance(
  d: DependenciasProcesador,
  turno: Turno,
  { anotar, antes, ...avance }: CambioDeLote,
): Promise<void> {
  await d.unidadDeTrabajo.enTransaccion(async (tx) => {
    const fila = await d.lotes.obtenerParaActualizar(turno.lote.id, tx);
    if (fila?.estado !== 'pendiente') return;
    await antes?.(tx);
    const motivos = anotar(leerMotivos(fila.motivosDescarte));
    await d.lotes.registrarAvance(turno.lote.id, { ...avance, motivos }, tx);
  });
}

function tokensDe(resultado: ResultadoGeneracion): number | null {
  const uso = resultado.usoTokens;
  if (resultado.tokensUsados !== undefined) return resultado.tokensUsados;
  if (uso?.total !== undefined) return uso.total;
  return uso ? (uso.entrada ?? 0) + (uso.salida ?? 0) : null;
}

/**
 * Tokens, costo y modelo de una respuesta; el proveedor simulado no tiene precio y no cuesta. Si respondió un
 * proveedor sin precio, se guardan los tokens sin costo: el gasto del mes ya no se puede verificar y el
 * tope falla de forma segura (PRECIO_IA_NO_CONFIGURADO), nunca como si la llamada fuera gratis.
 */
export function consumoDe(resultado: ResultadoGeneracion, precios: Precios): ConsumoDeLaLlamada {
  const tokens = tokensDe(resultado);
  const modelo = resultado.modelo;
  if (tokens === null) return { tokens, costoUsd: null, modelo };
  if (resultado.proveedor === 'simulado') return { tokens, costoUsd: 0, modelo };
  const precio = precios[resultado.proveedor];
  const costoUsd = precio
    ? calcularCostoUsd(resultado.usoTokens ?? { total: tokens }, precio)
    : null;
  return { tokens, costoUsd, modelo };
}

/** Anota la falla de la IA. Sin saldo la llamada no se atendió y no cuenta como pregunta pedida. */
export async function registrarFalla(
  d: DependenciasProcesador,
  turno: Turno,
  falla: FallaDeLaIa,
  ficha: Ficha,
): Promise<CierreDeLote | null> {
  const descartadas = falla.saldoAgotado ? 0 : 1;
  await guardarAvance(d, turno, {
    validas: 0,
    descartadas,
    ...SIN_CONSUMO,
    anotar: (m) =>
      falla.saldoAgotado ? anotarFalla(m, falla.codigo) : anotarFalla(m, falla.codigo, ficha),
  });
  return cierreTrasFalla(turno, falla);
}

/** Cuenta la falla y dice si hay que cerrar el lote: sin saldo, o tras varias fallas seguidas. */
export function cierreTrasFalla(turno: Turno, falla: FallaDeLaIa): CierreDeLote | null {
  turno.fallasSeguidas += 1;
  if (falla.saldoAgotado) return 'saldo_agotado';
  return turno.fallasSeguidas >= FALLAS_SEGUIDAS_PARA_CORTAR ? 'ia_no_disponible' : null;
}

export function revisar(turno: Turno, ficha: Ficha, resultado: ResultadoGeneracion): Problema[] {
  const propuesta = resultado.preguntas[0];
  if (!propuesta) {
    return [{ motivo: 'formato_invalido', detalle: 'La IA no devolvió ninguna pregunta.' }];
  }
  const prueba = turno.contenido.prueba;
  return revisarPropuesta(propuesta, {
    alternativas: prueba.opcionesMax,
    habilidad: ficha.habilidad.codigo,
    habilidadesValidas: prueba.habilidades.map((h) => h.codigo),
    enunciadosExistentes: turno.existentes,
    numerica: esNumerica(prueba.codigo),
  });
}

/** La propuesta válida lista para guardarse (alternativas barajadas); el texto y el orden los pone quien guarda. */
export function guardableDe(
  d: DependenciasProcesador,
  turno: Turno,
  propuesta: PreguntaPropuesta,
): PropuestaDeIa {
  const { prueba } = turno.contenido;
  return aPropuestaGuardable(
    propuesta,
    {
      loteId: turno.lote.id,
      pruebaId: prueba.id,
      contenidoId: turno.lote.contenidoId,
      habilidadId: prueba.habilidades.find((h) => h.codigo === propuesta.habilidad)!.id,
      textoEstimuloId: null,
      ordenEnTexto: null,
    },
    azarDe(d),
  );
}

/** Guarda la pregunta válida con su avance; si no se pudo guardar, la llamada ya se pagó: se anota igual. */
async function guardarValida(
  d: DependenciasProcesador,
  turno: Turno,
  ficha: Ficha,
  resultado: ResultadoGeneracion,
): Promise<void> {
  const propuesta = resultado.preguntas[0]!;
  const consumo = consumoDe(resultado, turno.precios);
  const guardable = guardableDe(d, turno, propuesta);
  try {
    await guardarAvance(d, turno, {
      validas: 1,
      descartadas: 0,
      ...consumo,
      anotar: (m) => m,
      antes: async (tx) => {
        await d.preguntas.guardarPropuestaDeIa(guardable, tx);
      },
    });
    turno.existentes.push(propuesta.enunciado);
  } catch (error) {
    registro.error('No se pudo guardar una pregunta de la IA', {
      loteId: turno.lote.id,
      error: claseDeError(error),
    });
    await guardarAvance(d, turno, {
      validas: 0,
      descartadas: 1,
      ...consumo,
      anotar: (m) => anotarFalla(m, 'ERROR_AL_GUARDAR', ficha),
    });
  }
}

/** Revisa la respuesta de la IA: la válida se guarda como borrador y la que no, se descarta con su motivo. */
export async function registrarRespuesta(
  d: DependenciasProcesador,
  turno: Turno,
  ficha: Ficha,
  resultado: ResultadoGeneracion,
): Promise<void> {
  turno.fallasSeguidas = 0;
  const problemas = revisar(turno, ficha, resultado);
  if (problemas.length === 0) return guardarValida(d, turno, ficha, resultado);
  const consumo = consumoDe(resultado, turno.precios);
  await guardarAvance(d, turno, {
    validas: 0,
    descartadas: 1,
    ...consumo,
    anotar: (m) => anotarDescarte(m, problemas, ficha),
  });
}
