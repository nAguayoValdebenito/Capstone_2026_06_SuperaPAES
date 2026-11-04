// HU-05.4 · RN-32 · CU-02: la API decide si el enlace sigue vigente.
import { useEffect, useRef, useState } from 'react';
import { ErrorApi } from '../api/cliente';
import { verificarCorreo } from '../servicios/verificacion';

export type EstadoVerificacion =
  | { tipo: 'verificando' }
  | { tipo: 'verificado'; yaVerificado: boolean }
  | { tipo: 'fallido'; mensaje: string; reintentable: boolean };

export const MENSAJES_VERIFICACION = {
  incompleto: 'Este enlace está incompleto. Ábrelo de nuevo desde tu correo.',
  noVigente: 'Este enlace ya no sirve: venció o pediste otro correo de verificación.',
  pedirOtro: 'Vuelve a la app y toca «Reenviar correo» en «Verifica tu correo».',
  general: 'No pudimos verificar tu correo. Inténtalo de nuevo en unos minutos.',
  exito:
    'Tu correo quedó verificado. Vuelve a la app para seguir practicando con tu cupo actualizado.',
  yaVerificado: 'Tu correo ya estaba verificado. Vuelve a la app para seguir practicando.',
} as const;

export function errorDeVerificacion(error: unknown): EstadoVerificacion {
  if (error instanceof ErrorApi) {
    if (error.codigo === 'VERIFICACION_NO_VIGENTE' || error.codigo === 'VALIDACION') {
      return { tipo: 'fallido', mensaje: MENSAJES_VERIFICACION.noVigente, reintentable: false };
    }
    if (error.codigo === 'SIN_CONEXION' || error.codigo === 'DEMASIADOS_INTENTOS') {
      return { tipo: 'fallido', mensaje: error.message, reintentable: true };
    }
  }
  return { tipo: 'fallido', mensaje: MENSAJES_VERIFICACION.general, reintentable: true };
}

export async function intentarVerificar(token: string): Promise<EstadoVerificacion> {
  if (!token.trim()) {
    return { tipo: 'fallido', mensaje: MENSAJES_VERIFICACION.incompleto, reintentable: false };
  }
  try {
    const resultado = await verificarCorreo(token);
    return { tipo: 'verificado', yaVerificado: resultado.yaVerificado };
  } catch (error) {
    return errorDeVerificacion(error);
  }
}

/** Reutiliza la petición al repetir efectos en StrictMode; no guarda el token en el navegador. */
export function useVerificarCorreo(token: string) {
  const [estado, cambiarEstado] = useState<EstadoVerificacion>({ tipo: 'verificando' });
  const [intento, cambiarIntento] = useState(0);
  const solicitud = useRef<Promise<EstadoVerificacion> | null>(null);

  useEffect(() => {
    let vigente = true;
    solicitud.current ??= intentarVerificar(token);
    void solicitud.current.then((resultado) => {
      if (vigente) cambiarEstado(resultado);
    });
    return () => {
      vigente = false;
    };
  }, [token, intento]);

  function reintentar() {
    solicitud.current = null;
    cambiarEstado({ tipo: 'verificando' });
    cambiarIntento((actual) => actual + 1);
  }

  return { estado, reintentar };
}
