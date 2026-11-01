// Transporte sin datos externos en errores ni logs. Un presupuesto abarca también el respaldo.
import {
  ErrorAplicacion,
  ErrorIANoDisponible,
  ErrorIARespuestaInvalida,
  ErrorIASaldoAgotado,
} from '../../comun/errores.js';
import { registro } from '../../comun/registro.js';
export const LIMITES_IA = {
  cabecerasMs: 120_000,
  cuerpoMs: 30_000,
  esperaReintentoMs: 1_500,
  maxReintentos: 1,
  maxTokens: 8192,
  // 8.192 tokens caben en unos 35 KB de JSON; el tope deja holgura pero corta una respuesta sin fin.
  maxBytes: 262_144,
} as const;

export interface PresupuestoIA {
  restantes: number;
  venceEn: number;
}

export const crearPresupuestoIA = (): PresupuestoIA => ({
  restantes: LIMITES_IA.maxReintentos,
  venceEn:
    Date.now() +
    (LIMITES_IA.maxReintentos + 1) * (LIMITES_IA.cabecerasMs + LIMITES_IA.cuerpoMs) +
    LIMITES_IA.maxReintentos * LIMITES_IA.esperaReintentoMs,
});

// Fallos del contenido que dio el modelo y que un segundo intento suele corregir (no es un rechazo de
// seguridad ni un truncamiento). Comparten el único reintento y el presupuesto de tiempo global.
export class ErrorContenidoReintentable extends ErrorIARespuestaInvalida {}
export class ErrorContenidoVacio extends ErrorContenidoReintentable {}
/** El texto del modelo no es JSON analizable (por ejemplo, una comilla perdida). */
export class ErrorJsonNoAnalizable extends ErrorContenidoReintentable {}
class ErrorRedOProveedor extends ErrorIANoDisponible {}

interface PeticionIA<T> {
  proveedor: 'deepseek' | 'gemini';
  url: string;
  cabeceras: Record<string, string>;
  cuerpo: unknown;
  interpretar(datos: unknown): T;
}

function comprobarEstado(respuesta: Response, proveedor: PeticionIA<unknown>['proveedor']): void {
  const campos = { proveedor, estadoHttp: respuesta.status };
  if (respuesta.ok) {
    registro.info('El proveedor de IA respondió', campos);
    return;
  }
  registro.error('El proveedor de IA rechazó la solicitud', campos);
  if (proveedor === 'deepseek' && respuesta.status === 402) throw new ErrorIASaldoAgotado();
  if (respuesta.status >= 500) throw new ErrorRedOProveedor();
  throw new ErrorIANoDisponible();
}

/** Lee el cuerpo por trozos y se detiene (cancelando la lectura) al pasar el límite de bytes. */
async function leerCuerpoAcotado(respuesta: Response): Promise<string> {
  const declarado = Number(respuesta.headers.get('content-length'));
  const lector = respuesta.body?.getReader();
  if (!lector) return '';
  if (Number.isFinite(declarado) && declarado > LIMITES_IA.maxBytes) {
    await lector.cancel();
    throw new ErrorIARespuestaInvalida();
  }
  const trozos: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const lectura = (await lector.read()) as { done: boolean; value?: Uint8Array };
    const value = lectura.value;
    if (lectura.done || value === undefined) break;
    total += value.byteLength;
    if (total > LIMITES_IA.maxBytes) {
      await lector.cancel();
      throw new ErrorIARespuestaInvalida();
    }
    trozos.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(trozos));
}

async function intentar<T>(peticion: PeticionIA<T>, presupuesto: PresupuestoIA): Promise<T> {
  const restante = presupuesto.venceEn - Date.now();
  if (restante <= 0) throw new ErrorIANoDisponible();
  const controlador = new AbortController();
  let temporizador = setTimeout(
    () => controlador.abort(),
    Math.min(restante, LIMITES_IA.cabecerasMs),
  );
  try {
    const respuesta = await fetch(peticion.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...peticion.cabeceras },
      body: JSON.stringify(peticion.cuerpo),
      signal: controlador.signal,
      redirect: 'error',
    });
    clearTimeout(temporizador);
    temporizador = setTimeout(
      () => controlador.abort(),
      Math.max(0, Math.min(presupuesto.venceEn - Date.now(), LIMITES_IA.cuerpoMs)),
    );
    comprobarEstado(respuesta, peticion.proveedor);
    const texto = await leerCuerpoAcotado(respuesta);
    let datos: unknown;
    try {
      datos = JSON.parse(texto) as unknown;
    } catch {
      throw new ErrorIARespuestaInvalida();
    }
    return peticion.interpretar(datos);
  } catch (error) {
    if (error instanceof ErrorAplicacion) throw error;
    registro.error('Falló la comunicación con IA', {
      proveedor: peticion.proveedor,
      motivo: controlador.signal.aborted ? 'timeout' : 'red',
    });
    if (controlador.signal.aborted) throw new ErrorIANoDisponible();
    throw new ErrorRedOProveedor();
  } finally {
    clearTimeout(temporizador);
    controlador.abort();
  }
}

export async function solicitarIA<T>(
  peticion: PeticionIA<T>,
  presupuesto: PresupuestoIA,
): Promise<T> {
  for (;;) {
    try {
      return await intentar(peticion, presupuesto);
    } catch (error) {
      const reintentable =
        error instanceof ErrorRedOProveedor || error instanceof ErrorContenidoReintentable;
      if (!reintentable) throw error;
      if (presupuesto.restantes === 0) {
        throw error instanceof ErrorContenidoReintentable
          ? new ErrorIARespuestaInvalida()
          : new ErrorIANoDisponible();
      }
      presupuesto.restantes -= 1;
      await new Promise<void>((resolver) =>
        setTimeout(
          resolver,
          Math.max(0, Math.min(presupuesto.venceEn - Date.now(), LIMITES_IA.esperaReintentoMs)),
        ),
      );
    }
  }
}
