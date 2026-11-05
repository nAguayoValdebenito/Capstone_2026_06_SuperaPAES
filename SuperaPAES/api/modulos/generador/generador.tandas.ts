// Recorre las fichas de un lote en tandas (tantas llamadas a la vez como diga la concurrencia). Quién guarda cada
// resultado lo decide el «registrador»: en línea (cada pregunta se guarda al llegar) o acumulado (lotes con texto).
import type { ResultadoGeneracion } from '../../adaptadores/ia/proveedor.js';
import type { Ficha } from './generador.fichas.js';
import type { CierreDeLote } from './generador.motivos.js';
import type { DependenciasProcesador, FallaDeLaIa, Turno } from './generador.procesador.tipos.js';
import { fichasQueFaltan, motivoParaParar, pedirPropuesta } from './generador.turno.js';

export interface Registrador {
  falla(falla: FallaDeLaIa, ficha: Ficha): Promise<CierreDeLote | null>;
  respuesta(ficha: Ficha, resultado: ResultadoGeneracion): Promise<void>;
}

/** Una tanda de fichas y el registro de cada resultado, en orden. */
async function correrTanda(
  d: DependenciasProcesador,
  turno: Turno,
  tanda: Ficha[],
  registrador: Registrador,
): Promise<CierreDeLote | null> {
  const intentos = await Promise.allSettled(tanda.map((ficha) => pedirPropuesta(d, turno, ficha)));
  let cierre: CierreDeLote | null = null;
  let inesperado: { error: unknown } | null = null;
  for (const [i, intento] of intentos.entries()) {
    if (intento.status === 'rejected') {
      inesperado ??= { error: intento.reason };
    } else if (intento.value.tipo === 'falla') {
      cierre ??= await registrador.falla(intento.value, tanda[i]!);
    } else {
      await registrador.respuesta(tanda[i]!, intento.value.resultado);
    }
  }
  // Lo que ya se pagó quedó registrado; un error inesperado deja el lote pendiente para el próximo turno.
  if (inesperado) throw inesperado.error;
  return cierre;
}

/** Pide una pregunta por cada ficha que falta, parando ante el plazo, el tope mensual o las fallas de la IA. */
export async function recorrerFichas(
  d: DependenciasProcesador,
  turno: Turno,
  registrador: Registrador,
): Promise<CierreDeLote> {
  const fichas = fichasQueFaltan(d, turno);
  for (let desde = 0; desde < fichas.length; desde += turno.concurrencia) {
    const parar = await motivoParaParar(d, turno);
    if (parar) return parar;
    const tanda = fichas.slice(desde, desde + turno.concurrencia);
    const cierre = await correrTanda(d, turno, tanda, registrador);
    if (cierre) return cierre;
  }
  return 'completo';
}
