// Estado y lógica de la página Nueva contraseña (A05; HU-06, CU-04): el estudiante abre el enlace del
// correo y escribe la contraseña nueva dos veces. La API valida RN-31 con el correo de la cuenta del
// enlace; aquí se revisa antes de enviar lo que no depende de él (largo y que las dos coincidan).
import { useCallback, useState } from 'react';
import { ErrorApi } from '../api/cliente';
import { restablecerContrasena } from '../servicios/recuperacion';
import { problemaContrasena } from '../utilidades/contrasena';

export type EstadoRestablecer =
  | { tipo: 'editando' }
  | { tipo: 'enviando' }
  | { tipo: 'restablecida' }
  | {
      tipo: 'fallido';
      mensaje: string;
      /** El error es de la contraseña: va bajo su campo. */
      deContrasena: boolean;
      /** El enlace ya no sirve: hay que pedir otro desde la app. */
      enlaceNoVigente: boolean;
    };

export const MENSAJES_RESTABLECER = {
  noCoinciden: 'Las dos contraseñas no coinciden.',
  enlaceIncompleto:
    'Este enlace está incompleto. Ábrelo de nuevo desde tu correo o pide uno nuevo desde la app.',
  pedirOtro:
    'Pide un enlace nuevo desde la app: en Iniciar sesión, toca «¿Olvidaste tu contraseña?». El enlace vence en 1 hora.',
  restablecida: 'Tu contraseña cambió. Vuelve a la app e inicia sesión con ella.',
  general: 'No se pudo cambiar la contraseña. Inténtalo de nuevo en unos minutos.',
} as const;

/** Lo que se revisa antes de enviar. El correo no se conoce aquí: la API lo compara. */
export function validarContrasenas(contrasena: string, repeticion: string): string | null {
  return (
    problemaContrasena(contrasena, '') ??
    (contrasena === repeticion ? null : MENSAJES_RESTABLECER.noCoinciden)
  );
}

/** Mensaje del primer problema de la contraseña en `detalles`, si la API lo trae. */
function mensajeDeContrasena(error: ErrorApi): string | null {
  if (!Array.isArray(error.detalles)) return null;
  for (const problema of error.detalles as unknown[]) {
    if (
      typeof problema === 'object' &&
      problema !== null &&
      'ruta' in problema &&
      problema.ruta === 'contrasena' &&
      'mensaje' in problema &&
      typeof problema.mensaje === 'string'
    ) {
      return problema.mensaje;
    }
  }
  return null;
}

const fallido = (
  mensaje: string,
  opciones: { deContrasena?: boolean; enlaceNoVigente?: boolean } = {},
): EstadoRestablecer => ({
  tipo: 'fallido',
  mensaje,
  deContrasena: opciones.deContrasena ?? false,
  enlaceNoVigente: opciones.enlaceNoVigente ?? false,
});

export function estadoDeError(error: unknown): EstadoRestablecer {
  if (!(error instanceof ErrorApi)) return fallido(MENSAJES_RESTABLECER.general);
  switch (error.codigo) {
    case 'VALIDACION':
      return fallido(mensajeDeContrasena(error) ?? error.message, { deContrasena: true });
    case 'ENLACE_NO_VIGENTE':
      return fallido(error.message, { enlaceNoVigente: true });
    case 'DEMASIADOS_INTENTOS':
    case 'SIN_CONEXION':
    case 'SIN_CONFIGURACION':
      return fallido(error.message);
    default:
      return fallido(MENSAJES_RESTABLECER.general);
  }
}

/** Valida y, si corresponde, pide a la API el cambio de contraseña. */
export async function intentarRestablecer(
  token: string,
  contrasena: string,
  repeticion: string,
): Promise<EstadoRestablecer> {
  const problema = validarContrasenas(contrasena, repeticion);
  if (problema) return fallido(problema, { deContrasena: true });
  try {
    await restablecerContrasena(token, contrasena);
    return { tipo: 'restablecida' };
  } catch (error) {
    return estadoDeError(error);
  }
}

export function useRestablecerContrasena(token: string) {
  const [estado, cambiarEstado] = useState<EstadoRestablecer>({ tipo: 'editando' });

  const enviar = useCallback(
    async (contrasena: string, repeticion: string) => {
      cambiarEstado({ tipo: 'enviando' });
      cambiarEstado(await intentarRestablecer(token, contrasena, repeticion));
    },
    [token],
  );

  return { estado, enviar };
}
