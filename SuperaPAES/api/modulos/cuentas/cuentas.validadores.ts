// Esquemas zod de entrada del módulo cuentas. Se usan con validar() en las rutas.
import { z } from 'zod';
import { idDeCuerpo, idDeRuta } from '../../comun/identificadores.js';
import { codigoInvitacion } from '../../comun/codigo-invitacion.js';
import { cabeEnBcrypt, refinarContrasena } from '../../comun/contrasenas.js';

/** Se guarda y se compara sin espacios y en minúsculas. */
const correo = z
  .string('Ingresa tu correo.')
  .trim()
  .toLowerCase()
  .pipe(
    z.email('Ingresa un correo válido.').max(150, 'El correo puede tener hasta 150 caracteres.'),
  );

/** Un refinamiento con su motivo (detalles[].motivo), para que la app sepa qué falta. */
const conMotivo = (mensaje: string, motivo: string) => ({ message: mensaje, params: { motivo } });

// La contraseña nueva se valida con RN-31 en el componente común (refinarContrasena). La del ingreso
// solo se limita a 72 bytes de UTF-8, para que la contraseña completa cuente en bcrypt.
const contrasena = z
  .string('Ingresa tu contraseña.')
  .min(1, 'Ingresa tu contraseña.')
  .refine(cabeEnBcrypt, 'La contraseña es demasiado larga.');

export const esquemaRegistro = z
  .strictObject({
    /** De 1 a 100 caracteres, sin espacios al inicio, al final ni repetidos. */
    nombre: z
      .string('Ingresa tu nombre.')
      .trim()
      .transform((valor) => valor.replace(/\s+/g, ' '))
      .pipe(
        z
          .string()
          .min(1, 'Ingresa tu nombre.')
          .max(100, 'El nombre puede tener hasta 100 caracteres.'),
      ),
    correo,
    contrasena: z.string('Ingresa tu contraseña.'),
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
      .array(idDeCuerpo, 'Indica los documentos legales aceptados.')
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
  contrasena: z
    .string('Ingresa la contraseña nueva.')
    .min(1, 'Ingresa la contraseña nueva.')
    .max(500),
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
  id: idDeRuta,
});

/** Cursos del perfil (A08): de 1° a 4° medio y egresado (contenido.nivel_escolar.codigo). */
const CURSOS_PERFIL = ['1M', '2M', '3M', '4M', 'EG'] as const;
/** RN-25: hasta tres áreas de carrera. */
const MAXIMO_AREAS_CARRERA = 3;
/** Las cinco pruebas de la PAES regular. */
const MAXIMO_PRUEBAS = 5;

const sinRepetir = (ids: readonly number[]) => new Set(ids).size === ids.length;

/** Curso o egreso (HU-29 esc. 1). El año de egreso solo va con EG; su tope lo revisa el servicio. */
const camposCurso = {
  curso: z.enum(CURSOS_PERFIL, 'Elige tu curso: de 1° a 4° medio, o indica que ya egresaste.'),
  anioEgreso: z
    .number('El año de egreso no es válido.')
    .refine(
      (anio) => Number.isInteger(anio) && anio >= 2000,
      conMotivo('El año de egreso no es válido.', 'anio_egreso_invalido'),
    )
    .optional(),
};

function refinarCurso(
  { curso, anioEgreso }: { curso: string; anioEgreso?: number | undefined },
  contexto: z.RefinementCtx,
): void {
  if (curso === 'EG' && anioEgreso === undefined) {
    contexto.addIssue({
      code: 'custom',
      path: ['anioEgreso'],
      ...conMotivo('Indica el año en que egresaste.', 'anio_egreso_requerido'),
    });
  }
  if (curso !== 'EG' && anioEgreso !== undefined) {
    contexto.addIssue({
      code: 'custom',
      path: ['anioEgreso'],
      ...conMotivo('El año de egreso solo se indica si ya egresaste.', 'anio_egreso_invalido'),
    });
  }
}

/** A11 (CU-05 1.a): confirmar o corregir el curso al empezar el año escolar. */
export const esquemaConfirmarCurso = z.strictObject(camposCurso).superRefine(refinarCurso);

/** HU-29.1 (CU-05): todo el perfil de una vez. Si existen las pruebas y el electivo, lo revisa el servicio. */
export const esquemaPerfil = z
  .strictObject({
    ...camposCurso,
    pruebas: z
      .array(idDeCuerpo, 'Elige las pruebas que rendirás.')
      .min(1, 'Elige al menos una prueba.')
      .max(MAXIMO_PRUEBAS, 'Puedes elegir hasta cinco pruebas.')
      .refine(sinRepetir, 'Elegiste una prueba más de una vez.'),
    electivoId: idDeCuerpo.nullable().default(null),
    pruebaReforzarId: idDeCuerpo.nullable().default(null),
    areasCarrera: z
      .array(idDeCuerpo, 'Indica las áreas de carrera.')
      .refine(
        (ids) => ids.length <= MAXIMO_AREAS_CARRERA,
        conMotivo(
          'Puedes marcar hasta tres áreas de carrera. Para cambiar una, primero desmarca otra.',
          'tope_areas_carrera',
        ),
      )
      .refine(sinRepetir, 'Marcaste un área de carrera más de una vez.')
      .default([]),
  })
  .superRefine((datos, contexto) => {
    refinarCurso(datos, contexto);
    // HU-29 esc. 4: la prueba a reforzar es una de las que rendirá.
    if (datos.pruebaReforzarId !== null && !datos.pruebas.includes(datos.pruebaReforzarId)) {
      contexto.addIssue({
        code: 'custom',
        path: ['pruebaReforzarId'],
        ...conMotivo(
          'La prueba a reforzar debe estar entre las que rendirás.',
          'reforzar_fuera_de_pruebas',
        ),
      });
    }
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
export type DatosPerfil = z.output<typeof esquemaPerfil>;
export type DatosCurso = z.output<typeof esquemaConfirmarCurso>;
