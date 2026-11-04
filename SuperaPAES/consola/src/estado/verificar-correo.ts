// Estado de la página Verificar correo (HU-05.4, CU-02 pasos 2 y 3): el estudiante abre el enlace del correo
// y la página lo verifica de inmediato, sin sesión. La API responde igual si el correo ya estaba verificado,
// así que repetir la llamada no hace daño.
import { useEffect, useRef, useState } from 'react';
import { ErrorApi } from '../api/cliente';
import { verificarCorreo } from '../servicios/verificacion';

export type EstadoVerificacion =
  | { tipo: 'verificando' }
  | { tipo: 'verificado' }
  | { tipo: 'ya_verificado' }
  /** CU-02 3.b: el enlace ya se usó, venció o se pidió otro correo. */
  | { tipo: 'no_vigente'; mensaje: string }
  | { tipo: 'fallido'; mensaje: string };

export const MENSAJES_VERIFICACION = {
  enlaceIncompleto: 'Este enlace está incompleto. Ábrelo de nuevo desde tu correo.',
  verificado: 'Tu cupo diario subió de 10 a 20 preguntas. Vuelve a la app para seguir practicando.',
  yaVerificado: 'No tienes que hacer nada más. Vuelve a la app para seguir practicando.',
  pedirOtro:
    'Abre la app y, en Verificar correo, toca «Reenviar correo». El enlace vence en 24 horas.',
  general: 'No se pudo verificar tu correo. Inténtalo de nuevo en unos minutos.',
} as const;

export function estadoDeError(error: unknown): EstadoVerificacion {
  if (!(error instanceof ErrorApi)) {
    return { tipo: 'fallido', mensaje: MENSAJES_VERIFICACION.general };
  }
  switch (error.codigo) {
    case 'VERIFICACION_NO_VIGENTE':
      return { tipo: 'no_vigente', mensaje: error.message };
    case 'DEMASIADOS_INTENTOS':
    case 'SIN_CONEXION':
    case 'SIN_CONFIGURACION':
      return { tipo: 'fallido', mensaje: error.message };
    default:
      return { tipo: 'fallido', mensaje: MENSAJES_VERIFICACION.general };
  }
}

export async function verificarConEnlace(token: string): Promise<EstadoVerificacion> {
  if (!token.trim()) {
    return { tipo: 'no_vigente', mensaje: MENSAJES_VERIFICACION.enlaceIncompleto };
  }
  try {
    const { yaVerificado } = await verificarCorreo(token);
    return { tipo: yaVerificado ? 'ya_verificado' : 'verificado' };
  } catch (error) {
    return estadoDeError(error);
  }
}

/**
 * Reutiliza la petición si React repite los efectos. Solo un reintento explícito emite otra petición.
 * La página monta una instancia nueva al cambiar el token para no mostrar un resultado anterior.
 */
export function useVerificacionCorreo(token: string) {
  const [estado, cambiarEstado] = useState<EstadoVerificacion>({ tipo: 'verificando' });
  const [intento, cambiarIntento] = useState(0);
  const pedido = useRef<{
    token: string;
    intento: number;
    resultado: Promise<EstadoVerificacion>;
  } | null>(null);

  useEffect(() => {
    if (pedido.current?.token !== token || pedido.current.intento !== intento) {
      pedido.current = { token, intento, resultado: verificarConEnlace(token) };
    }
    let vigente = true;
    void pedido.current.resultado.then((resultado) => {
      if (vigente) cambiarEstado(resultado);
    });
    return () => {
      vigente = false;
    };
  }, [token, intento]);

  function reintentar() {
    cambiarEstado({ tipo: 'verificando' });
    cambiarIntento((actual) => actual + 1);
  }

  return { estado, reintentar };
}
