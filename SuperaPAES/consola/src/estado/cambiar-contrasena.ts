// Estado y lógica de la página Cambia tu contraseña: el usuario interno escribe su contraseña actual y la
// nueva dos veces. La consola la abre sola mientras la cuenta tenga la contraseña que le asignó el
// administrador, y desde el menú de la cuenta cuando la persona quiera. Antes de enviar se revisan los
// requisitos de RN-31 que no dependen del correo (los mismos mensajes de Nueva contraseña); la API
// comprueba la actual y vuelve a validar la nueva con el correo de la cuenta.
import { useCallback, useState } from 'react';
import { ErrorApi } from '../api/cliente';
import { cambiarContrasena } from '../servicios/cuentas';
import { useSesion } from './contexto-sesion';
import { validarContrasenas } from './restablecer-contrasena';

/** Campo bajo el que va el error; null si es un aviso general. */
export type CampoConError = 'actual' | 'nueva' | null;

export type EstadoCambio =
  | { tipo: 'editando' }
  | { tipo: 'enviando' }
  | { tipo: 'cambiada' }
  | { tipo: 'fallido'; mensaje: string; campo: CampoConError };

export const MENSAJES_CAMBIO = {
  asignada:
    'Tu cuenta tiene la contraseña que te asignó el administrador. Elige una propia para seguir usando la consola.',
  voluntaria: 'Escribe tu contraseña actual y elige la nueva.',
  faltaActual: 'Escribe tu contraseña actual.',
  igualActual: 'La contraseña nueva debe ser distinta de la actual.',
  general: 'No se pudo cambiar la contraseña. Inténtalo de nuevo en unos minutos.',
} as const;

export interface DatosCambio {
  actual: string;
  nueva: string;
  repeticion: string;
}

const fallido = (mensaje: string, campo: CampoConError): EstadoCambio => ({
  tipo: 'fallido',
  mensaje,
  campo,
});

/** Lo que se revisa antes de enviar. El correo no se conoce aquí: la API lo compara. */
export function validarCambio({ actual, nueva, repeticion }: DatosCambio): EstadoCambio | null {
  if (actual === '') return fallido(MENSAJES_CAMBIO.faltaActual, 'actual');
  const problema = validarContrasenas(nueva, repeticion);
  if (problema) return fallido(problema, 'nueva');
  return nueva === actual ? fallido(MENSAJES_CAMBIO.igualActual, 'nueva') : null;
}

/** Mensaje del primer problema de `nueva` en `detalles`, si la API lo trae. */
function mensajeDeNueva(error: ErrorApi): string | null {
  if (!Array.isArray(error.detalles)) return null;
  const problema = (error.detalles as unknown[]).find(
    (d): d is { ruta: string; mensaje: string } =>
      typeof d === 'object' &&
      d !== null &&
      'ruta' in d &&
      d.ruta === 'nueva' &&
      'mensaje' in d &&
      typeof d.mensaje === 'string',
  );
  return problema?.mensaje ?? null;
}

export function estadoDeErrorCambio(error: unknown): EstadoCambio {
  if (!(error instanceof ErrorApi)) return fallido(MENSAJES_CAMBIO.general, null);
  switch (error.codigo) {
    case 'VALIDACION':
      return fallido(mensajeDeNueva(error) ?? error.message, 'nueva');
    // La API responde 401 con «La contraseña actual no es correcta.».
    case 'NO_AUTENTICADO':
      return fallido(error.message, 'actual');
    case 'DEMASIADOS_INTENTOS':
    case 'SIN_CONEXION':
    case 'SIN_CONFIGURACION':
      return fallido(error.message, null);
    default:
      return fallido(MENSAJES_CAMBIO.general, null);
  }
}

/** Valida y, si corresponde, pide a la API el cambio de contraseña. */
export async function intentarCambio(datos: DatosCambio): Promise<EstadoCambio> {
  const problema = validarCambio(datos);
  if (problema) return problema;
  try {
    await cambiarContrasena(datos.actual, datos.nueva);
    return { tipo: 'cambiada' };
  } catch (error) {
    return estadoDeErrorCambio(error);
  }
}

export function useCambiarContrasena() {
  const { marcarContrasenaCambiada } = useSesion();
  const [estado, cambiarEstado] = useState<EstadoCambio>({ tipo: 'editando' });

  const enviar = useCallback(
    async (datos: DatosCambio) => {
      cambiarEstado({ tipo: 'enviando' });
      const resultado = await intentarCambio(datos);
      // Primero se quita la marca: así la página puede volver a la consola sin que la vuelvan a pedir.
      if (resultado.tipo === 'cambiada') marcarContrasenaCambiada();
      cambiarEstado(resultado);
    },
    [marcarContrasenaCambiada],
  );

  return { estado, enviar };
}
