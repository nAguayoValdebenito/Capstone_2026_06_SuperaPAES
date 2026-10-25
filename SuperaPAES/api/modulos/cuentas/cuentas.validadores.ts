// Esquemas zod de entrada del módulo cuentas. Se usan con validar() en las rutas.
import { z } from 'zod';
import { codigoInvitacion } from '../../comun/codigo-invitacion.js';
import { cabeEnBcrypt, refinarContrasena } from '../../comun/contrasenas.js';

/** Se guarda y se compara sin espacios y en minúsculas. */
const correo = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(
    z.email('Ingresa un correo válido.').max(150, 'El correo puede tener hasta 150 caracteres.'),
  );

/** Un refinamiento con su motivo (detalles[].motivo), para que la app sepa qué falta. */
const conMotivo = (mensaje: string, motivo: string) => ({ message: mensaje, params: { motivo } });

// La contraseña nueva se valida con RN-31 en el componente común (refinarContrasena). La del ingreso
// solo se limita a 72 bytes de UTF-8, para que la contraseña completa cuente en bcrypt.
const contrasena = z.string().min(1).refine(cabeEnBcrypt, 'La contraseña es demasiado larga.');

export const esquemaRegistro = z
  .strictObject({
    /** De 1 a 100 caracteres, sin espacios al inicio, al final ni repetidos. */
    nombre: z
      .string()
      .trim()
      .transform((valor) => valor.replace(/\s+/g, ' '))
      .pipe(
        z
          .string()
          .min(1, 'Ingresa tu nombre.')
          .max(100, 'El nombre puede tener hasta 100 caracteres.'),
      ),
    correo,
    contrasena: z.string(),
    /** RN-18 (HU-01 esc. 5): la app es para personas de 14 años o más; sin la declaración no se crea nada. */
    declaraTenerCatorceAnios: z
      .unknown()
      .refine(
        (valor) => valor === true,
        conMotivo(
          'Debes declarar que tienes 14 años o más para crear una cuenta.',
          'edad_no_declarada',
        ),
      ),
    /**
     * Ids de contenido.documento_legal aceptados (HU-01 esc. 1): deben ser exactamente las versiones
     * vigentes de los documentos obligatorios (términos y privacidad). Lo comprueba el servicio
     * (motivo documentos_no_vigentes); sin la lista, falta aceptar los dos.
     */
    documentosAceptados: z
      .array(z.number().int().positive(), 'Indica los documentos legales aceptados.')
      .max(10)
      .default([]),
    codigoInvitacion: codigoInvitacion.optional(),
  })
  .superRefine(refinarContrasena);

export const esquemaIngreso = z.strictObject({ correo, contrasena });

/** Descripción del dispositivo que guarda la sesión (app.token_sesion.dispositivo, hasta 100 caracteres). */
const MAXIMO_DISPOSITIVO = 100;

/** Ingreso de la app: además, un nombre de dispositivo opcional (vacío cuenta como no enviado). */
export const esquemaIngresoApp = z.strictObject({
  correo,
  contrasena,
  dispositivo: z
    .string()
    .trim()
    .max(MAXIMO_DISPOSITIVO, 'El nombre del dispositivo es demasiado largo.')
    .optional()
    .transform((valor) => valor || undefined),
});

export const esquemaRecuperacion = z.strictObject({ correo });

/**
 * Crear la contraseña nueva con el enlace del correo (HU-06 esc. 2 y 3). La contraseña se valida con
 * RN-31 en el servicio, porque necesita el correo de la cuenta del enlace; aquí solo se acota su tamaño.
 */
export const esquemaRestablecer = z.strictObject({
  token: z.string().min(1).max(100),
  contrasena: z.string().min(1, 'Ingresa la contraseña nueva.').max(500),
});

/** Renovar y cerrar la sesión: el token de renovación que entregó el ingreso (o la última renovación). */
export const esquemaTokenRenovacion = z.strictObject({
  tokenRenovacion: z.string().min(1).max(100),
});

/** Verificar con el enlace del correo: el token que la consola lee de /verificar-correo?token=. */
export const esquemaEnlaceVerificacion = z.strictObject({ token: z.string().min(1).max(100) });

/** Verificar con el código de 6 dígitos que el estudiante escribe en la app (A06). */
export const esquemaCodigoVerificacion = z.strictObject({
  codigo: z.string().regex(/^\d{6}$/, 'El código tiene 6 dígitos.'),
});

/** C15: buscar a un estudiante por su correo (consulta ?correo=). */
export const esquemaBusquedaEstudiante = z.strictObject({ correo });

export const esquemaIdEstudiante = z.strictObject({
  id: z.string().regex(/^[1-9]\d{0,17}$/, 'El identificador no es válido.'),
});

export type DatosRegistro = z.output<typeof esquemaRegistro>;
export type Credenciales = z.output<typeof esquemaIngreso>;
export type CredencialesApp = z.output<typeof esquemaIngresoApp>;
export type DatosRecuperacion = z.output<typeof esquemaRecuperacion>;
export type DatosRestablecer = z.output<typeof esquemaRestablecer>;
export type DatosTokenRenovacion = z.output<typeof esquemaTokenRenovacion>;
export type DatosEnlaceVerificacion = z.output<typeof esquemaEnlaceVerificacion>;
export type DatosCodigoVerificacion = z.output<typeof esquemaCodigoVerificacion>;
export type DatosBusquedaEstudiante = z.output<typeof esquemaBusquedaEstudiante>;
export type ParametrosEstudiante = z.output<typeof esquemaIdEstudiante>;
