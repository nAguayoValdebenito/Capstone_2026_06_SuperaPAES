// Lógica de la página de invitación (W01 y W02): el código del link (RN-33) y los enlaces de las
// tiendas, de las variables públicas de la consola.

/** RN-33: 6 caracteres, letras mayúsculas y números, sin 0, O, 1 ni I. */
const FORMATO_CODIGO = /^[A-HJ-NP-Z2-9]{6}$/;

/** El código del link en mayúsculas, o null si no tiene el formato de RN-33. */
export function codigoDeInvitacion(texto: string | undefined): string | null {
  const codigo = (texto ?? '').trim().toUpperCase();
  return FORMATO_CODIGO.test(codigo) ? codigo : null;
}

export interface EnlacesTiendas {
  googlePlay?: string;
  appStore?: string;
}

/**
 * Los enlaces de las tiendas, de las variables públicas de Vercel: durante la prueba cerrada, el de
 * inscripción de Google Play y el público de TestFlight. Uno vacío no se muestra como enlace.
 */
export function enlacesTiendas(variables: Partial<ImportMetaEnv>): EnlacesTiendas {
  const limpio = (valor: string | undefined) => valor?.trim() || undefined;
  const googlePlay = limpio(variables.VITE_ENLACE_GOOGLE_PLAY);
  const appStore = limpio(variables.VITE_ENLACE_APP_STORE);
  return { ...(googlePlay && { googlePlay }), ...(appStore && { appStore }) };
}
