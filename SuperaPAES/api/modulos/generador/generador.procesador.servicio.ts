// El consumidor de la cola de generación (CU-17 pasos 3 a 6, HU-16.2, HU-17): el worker toma cada lote
// pendiente, llama a la IA una vez por pregunta (con su ficha), revisa la propuesta y guarda las válidas como
// borrador. Cada resultado se guarda en una transacción propia junto con el avance del lote (generador.avance.ts),
// así que si el proceso muere el lote sigue pendiente con lo ya hecho y el siguiente turno continúa donde quedó:
// calcula las fichas que faltan (cantidad − válidas − descartadas), sin duplicar ni reiniciar.
// Un candado de sesión de PostgreSQL, por lote, impide que dos procesos trabajen el mismo lote a la vez.
// Un lote se cierra «completado» si alguna pregunta fue válida y «fallido» si ninguna (decisión sobre el DAS 4.a
// y 4.b, que se anota en el PR); la falla, si la hubo, queda en motivos_descarte.
import { mensajeDeError, registro } from '../../comun/registro.js';
import { registrarFalla, registrarRespuesta } from './generador.avance.js';
import type { Ficha } from './generador.fichas.js';
import { anotarCierre, leerMotivos, type CierreDeLote } from './generador.motivos.js';
import type { DependenciasProcesador, Turno } from './generador.procesador.tipos.js';
import { fichasQueFaltan, pedirPropuesta, prepararTurno } from './generador.turno.js';

export type { DependenciasProcesador, OpcionesProcesador } from './generador.procesador.tipos.js';

/** Plazo máximo del turno de un lote; al vencer se cierra con lo que tenga (ajuste A). */
export const PLAZO_MAXIMO_LOTE_MS = 20 * 60_000;
/** Los candados de los lotes viven en su propio rango, lejos de los de transacción (hashtext, 32 bits). */
const BASE_DE_CLAVES = 1n << 62n;

export const claveDeLote = (id: string): bigint => BASE_DE_CLAVES + BigInt(id);

/** Antes de cada tanda: el plazo del turno y el tope mensual de gasto (RNF-03), con lo ya gastado. */
async function motivoParaParar(
  d: DependenciasProcesador,
  turno: Turno,
): Promise<CierreDeLote | null> {
  const ahora = d.reloj();
  if (ahora.getTime() >= turno.limiteMs) return 'plazo';
  const { gastado, sinCosto } = await d.lotes.gastoMensual(ahora);
  if (sinCosto) return 'precio_no_configurado';
  return gastado >= turno.maximoMensual ? 'tope_mensual' : null;
}

/** Una tanda de fichas (tantas como la concurrencia) y el registro de cada resultado, en orden. */
async function correrTanda(
  d: DependenciasProcesador,
  turno: Turno,
  tanda: Ficha[],
): Promise<CierreDeLote | null> {
  const intentos = await Promise.allSettled(tanda.map((ficha) => pedirPropuesta(d, turno, ficha)));
  let cierre: CierreDeLote | null = null;
  let inesperado: { error: unknown } | null = null;
  for (const [i, intento] of intentos.entries()) {
    if (intento.status === 'rejected') {
      inesperado ??= { error: intento.reason };
    } else if (intento.value.tipo === 'falla') {
      cierre ??= await registrarFalla(d, turno, intento.value);
    } else {
      await registrarRespuesta(d, turno, tanda[i]!, intento.value.resultado);
    }
  }
  // Lo que ya se pagó quedó guardado; un error inesperado deja el lote pendiente para el próximo turno.
  if (inesperado) throw inesperado.error;
  return cierre;
}

async function trabajar(d: DependenciasProcesador, turno: Turno): Promise<CierreDeLote> {
  const fichas = fichasQueFaltan(d, turno);
  for (let desde = 0; desde < fichas.length; desde += turno.concurrencia) {
    const parar = await motivoParaParar(d, turno);
    if (parar) return parar;
    const cierre = await correrTanda(d, turno, fichas.slice(desde, desde + turno.concurrencia));
    if (cierre) return cierre;
  }
  return 'completo';
}

/** Cierra el lote: completado si alguna pregunta fue válida, fallido si ninguna. */
async function cerrarLote(d: DependenciasProcesador, id: string, cierre: CierreDeLote) {
  await d.unidadDeTrabajo.enTransaccion(async (tx) => {
    const fila = await d.lotes.obtenerParaActualizar(id, tx);
    if (fila?.estado !== 'pendiente') return;
    const motivos = anotarCierre(leerMotivos(fila.motivosDescarte), cierre);
    await d.lotes.cerrar(id, fila.validas > 0 ? 'completado' : 'fallido', motivos, tx);
  });
}

async function procesarLote(d: DependenciasProcesador, id: string): Promise<boolean> {
  const lote = await d.lotes.obtener(id);
  if (lote?.estado !== 'pendiente') return false;
  const plazoMs = d.opciones?.plazoMaximoMs ?? PLAZO_MAXIMO_LOTE_MS;
  const turno = await prepararTurno(d, lote, plazoMs);
  await cerrarLote(d, id, typeof turno === 'string' ? turno : await trabajar(d, turno));
  return true;
}

export function crearProcesador(d: DependenciasProcesador) {
  return {
    /** Procesa los lotes pendientes que ningún otro proceso tiene tomados; devuelve cuántos cerró. */
    async procesarPendientes(): Promise<number> {
      let procesados = 0;
      for (const id of await d.lotes.idsPendientes()) {
        try {
          const trabajo = await d.candados.conCandado(claveDeLote(id), () => procesarLote(d, id));
          if (trabajo.tomado && trabajo.valor) procesados += 1;
        } catch (error) {
          registro.error('Falló un lote de generación', {
            loteId: id,
            error: mensajeDeError(error),
          });
        }
      }
      return procesados;
    },
  };
}
