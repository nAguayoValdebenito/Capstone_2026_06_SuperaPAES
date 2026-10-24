// Estado y lógica del formulario de ingreso a la consola (C00), el mismo para administrador y docente.
// La consola no tiene registro: solo entran los usuarios internos activos que crea el administrador
// (HU-04). Los mensajes no revelan el caso: una contraseña incorrecta, un correo sin cuenta interna,
// una cuenta de estudiante y un usuario desactivado reciben la misma respuesta.
import { useCallback, useState } from 'react';
import { ErrorApi } from '../api/cliente';
import { ingresar } from '../servicios/cuentas';
import type { Credenciales, SesionIniciada } from '../tipos';
import { useSesion } from './contexto-sesion';

export type EstadoIngreso =
  | { tipo: 'editando' }
  | { tipo: 'enviando' }
  | { tipo: 'ingresado' }
  | { tipo: 'fallido'; mensaje: string };

export const MENSAJES_INGRESO = {
  credenciales: 'Correo o contraseña incorrectos.',
  intentos: 'Hiciste demasiados intentos. Espera unos minutos y vuelve a intentarlo.',
  datos: 'Revisa el correo y la contraseña.',
  general: 'No se pudo iniciar sesión. Inténtalo de nuevo en unos minutos.',
} as const;

export function mensajeErrorIngreso(error: unknown): string {
  if (!(error instanceof ErrorApi)) return MENSAJES_INGRESO.general;
  switch (error.codigo) {
    case 'NO_AUTENTICADO':
    case 'SIN_PERMISO':
      return MENSAJES_INGRESO.credenciales;
    case 'DEMASIADOS_INTENTOS':
      return MENSAJES_INGRESO.intentos;
    case 'VALIDACION':
      return MENSAJES_INGRESO.datos;
    case 'SIN_CONEXION':
    case 'SIN_CONFIGURACION':
      return error.message;
    default:
      return MENSAJES_INGRESO.general;
  }
}

/** Pide el ingreso a la API y, si responde con una sesión de la consola, la inicia. */
export async function intentarIngreso(
  credenciales: Credenciales,
  iniciarSesion: (sesion: SesionIniciada) => boolean,
): Promise<EstadoIngreso> {
  try {
    const sesion = await ingresar(credenciales);
    return iniciarSesion(sesion)
      ? { tipo: 'ingresado' }
      : { tipo: 'fallido', mensaje: MENSAJES_INGRESO.credenciales };
  } catch (error) {
    return { tipo: 'fallido', mensaje: mensajeErrorIngreso(error) };
  }
}

export function useIngreso() {
  const { iniciarSesion } = useSesion();
  const [estado, cambiarEstado] = useState<EstadoIngreso>({ tipo: 'editando' });

  const enviar = useCallback(
    async (credenciales: Credenciales) => {
      cambiarEstado({ tipo: 'enviando' });
      cambiarEstado(await intentarIngreso(credenciales, iniciarSesion));
    },
    [iniciarSesion],
  );

  return { estado, enviar };
}
