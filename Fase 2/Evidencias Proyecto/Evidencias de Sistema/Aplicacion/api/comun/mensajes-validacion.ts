// Mensajes de validación en español para toda la API. zod trae los suyos en inglés ("Too small:
// expected string to have >=1 characters"); aquí se reemplazan por frases que una persona entiende y,
// para lo que no se cubre, se usa el idioma español de zod. Los esquemas siguen pudiendo poner su propio
// mensaje en un campo (por ejemplo «Ingresa tu contraseña.»), que tiene prioridad sobre este.
import { z } from 'zod';

const FALTA_DATO = 'Falta un dato obligatorio.';
const respaldo = z.locales.es().localeError;

type Problema = z.core.$ZodRawIssue;

function mensajeEnEspanol(problema: Problema): string | undefined {
  switch (problema.code) {
    case 'invalid_type':
      return problema.input === undefined ? FALTA_DATO : 'El dato no tiene el tipo esperado.';
    case 'too_small':
      return problema.origin === 'string' && Number(problema.minimum) <= 1
        ? FALTA_DATO
        : 'El dato es demasiado corto o pequeño.';
    case 'too_big':
      return 'El dato es demasiado largo o grande.';
    case 'unrecognized_keys':
      return 'Hay un dato que no corresponde a este formulario.';
    default:
      return undefined;
  }
}

/** Activa los mensajes en español de zod para todo el proceso. Es seguro llamarla más de una vez. */
export function usarMensajesDeValidacionEnEspanol(): void {
  z.config({ localeError: (problema) => mensajeEnEspanol(problema) ?? respaldo(problema) });
}
