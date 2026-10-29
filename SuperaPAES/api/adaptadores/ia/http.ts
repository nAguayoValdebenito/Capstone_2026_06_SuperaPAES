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

export class ErrorContenidoVacio extends ErrorIARespuestaInvalida {}
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
    const texto = await respuesta.text();
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
        error instanceof ErrorRedOProveedor || error instanceof ErrorContenidoVacio;
      if (!reintentable) throw error;
      if (presupuesto.restantes === 0) {
        throw error instanceof ErrorContenidoVacio
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
