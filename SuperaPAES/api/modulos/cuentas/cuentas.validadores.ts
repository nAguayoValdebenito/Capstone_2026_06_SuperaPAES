// Esquemas zod de entrada del módulo cuentas. Se usan con validar() en las rutas.
import { z } from 'zod';
import { codigoInvitacion } from '../../comun/codigo-invitacion.js';
import { cabeEnBcrypt, refinarContrasena } from '../../comun/contrasenas.js';

const correo = z
  .email('Ingresa un correo válido.')
  .max(150)
  .transform((valor) => valor.toLowerCase());

// La contraseña nueva se valida con RN-31 en el componente común (refinarContrasena). La del ingreso
// solo se limita a 72 bytes de UTF-8, para que la contraseña completa cuente en bcrypt.
const contrasena = z.string().min(1).refine(cabeEnBcrypt, 'La contraseña es demasiado larga.');

export const esquemaRegistro = z
  .strictObject({
    nombre: z.string().trim().min(1).max(100),
    correo,
    contrasena: z.string(),
    /**
     * Aceptación de las versiones vigentes de los documentos obligatorios (contenido.tipo_documento_legal
     * con obligatorio = true): términos y condiciones, y política de privacidad. Cada aceptación queda
     * en app.consentimiento con su contenido.documento_legal.
     */
    aceptaTerminos: z.literal(true),
    aceptaPrivacidad: z.literal(true),
    /** RN-18: la app es para personas de 14 años o más. */
    declaraTenerCatorceAnios: z.literal(true),
    codigoInvitacion: codigoInvitacion.optional(),
  })
  .superRefine(refinarContrasena);

export const esquemaIngreso = z.strictObject({ correo, contrasena });

export const esquemaRecuperacion = z.strictObject({ correo });

export type DatosRegistro = z.output<typeof esquemaRegistro>;
export type Credenciales = z.output<typeof esquemaIngreso>;
export type DatosRecuperacion = z.output<typeof esquemaRecuperacion>;
