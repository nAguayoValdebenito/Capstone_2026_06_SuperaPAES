// Esquemas zod de entrada del módulo cuentas. Se usan con validar() en las rutas.
import { z } from 'zod';

const correo = z
  .email('Ingresa un correo válido.')
  .max(150)
  .transform((valor) => valor.toLowerCase());

// bcrypt solo usa los primeros 72 bytes en UTF-8 (una tilde o una ñ ocupan 2): se limita por bytes,
// no por caracteres, para que la contraseña completa cuente.
const MAXIMO_BYTES_CONTRASENA = 72;
const caberEnBcrypt = (valor: string) =>
  Buffer.byteLength(valor, 'utf8') <= MAXIMO_BYTES_CONTRASENA;
const MENSAJE_LARGA = 'La contraseña es demasiado larga.';

const contrasenaNueva = z
  .string()
  .min(8, 'Usa al menos 8 caracteres.')
  .refine(caberEnBcrypt, MENSAJE_LARGA);
const contrasena = z.string().min(1).refine(caberEnBcrypt, MENSAJE_LARGA);

export const esquemaRegistro = z.strictObject({
  nombre: z.string().trim().min(1).max(100),
  correo,
  contrasena: contrasenaNueva,
  /** Aceptación de los términos y condiciones vigentes (app.consentimiento tipo terminos). */
  aceptaTerminos: z.literal(true),
  /** RN-18: la app es para personas de 14 años o más. */
  declaraTenerCatorceAnios: z.literal(true),
  codigoInvitacion: z.string().trim().min(1).max(12).optional(),
});

export const esquemaIngreso = z.strictObject({ correo, contrasena });

export const esquemaRecuperacion = z.strictObject({ correo });

export type DatosRegistro = z.output<typeof esquemaRegistro>;
export type Credenciales = z.output<typeof esquemaIngreso>;
export type DatosRecuperacion = z.output<typeof esquemaRecuperacion>;
