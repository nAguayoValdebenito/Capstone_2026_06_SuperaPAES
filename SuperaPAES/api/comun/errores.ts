// Errores propios de la API. El middleware de errores los convierte al formato { data, error, meta }.

export interface ExtrasError {
  detalles?: unknown;
  causa?: unknown;
}

export class ErrorAplicacion extends Error {
  readonly detalles?: unknown;

  constructor(
    readonly estadoHttp: number,
    readonly codigo: string,
    mensaje: string,
    extras?: ExtrasError,
  ) {
    super(mensaje, extras && 'causa' in extras ? { cause: extras.causa } : undefined);
    this.name = new.target.name;
    this.detalles = extras?.detalles;
  }
}

export class ErrorSolicitudInvalida extends ErrorAplicacion {
  constructor(mensaje = 'La solicitud no tiene un formato válido.') {
    super(400, 'SOLICITUD_INVALIDA', mensaje);
  }
}

export class ErrorValidacion extends ErrorAplicacion {
  constructor(detalles: unknown, mensaje = 'Los datos enviados no son válidos.') {
    super(400, 'VALIDACION', mensaje, { detalles });
  }
}

export class ErrorNoAutenticado extends ErrorAplicacion {
  constructor(mensaje = 'Debes iniciar sesión.') {
    super(401, 'NO_AUTENTICADO', mensaje);
  }
}

export class ErrorSinPermiso extends ErrorAplicacion {
  constructor(mensaje = 'No tienes permiso para realizar esta acción.') {
    super(403, 'SIN_PERMISO', mensaje);
  }
}

/**
 * 403 CUENTA_DESACTIVADA: el correo y la contraseña son correctos, pero un administrador desactivó
 * la cuenta (CU-23 3.b). Solo lo ve quien conoce la contraseña, así que no revela qué correos existen.
 */
export class ErrorCuentaDesactivada extends ErrorAplicacion {
  constructor(
    mensaje = 'Tu cuenta está desactivada. Contacta a un administrador para que la vuelva a activar.',
  ) {
    super(403, 'CUENTA_DESACTIVADA', mensaje);
  }
}

export class ErrorNoEncontrado extends ErrorAplicacion {
  constructor(mensaje = 'El recurso solicitado no existe.') {
    super(404, 'NO_ENCONTRADO', mensaje);
  }
}

/** Código 409 CONFLICTO del catálogo de errores. */
export class ErrorConflicto extends ErrorAplicacion {
  constructor(mensaje: string) {
    super(409, 'CONFLICTO', mensaje);
  }
}

/**
 * RN-32, CU-02 3.b: el enlace o el código de verificación ya se usó, se anuló al pedir un correo nuevo,
 * venció o no existe. El estudiante debe pedir un correo nuevo.
 */
export class ErrorVerificacionNoVigente extends ErrorAplicacion {
  constructor() {
    super(
      409,
      'VERIFICACION_NO_VIGENTE',
      'Este enlace o código ya no sirve: se usó, venció o pediste un correo nuevo. Pide que te enviemos otro correo.',
    );
  }
}

/** RN-32, CU-02 3.a: el código de verificación no es el correcto; quedan intentos. */
export class ErrorCodigoIncorrecto extends ErrorAplicacion {
  constructor(intentosRestantes: number) {
    super(
      400,
      'CODIGO_INCORRECTO',
      `El código no es correcto. Te ${intentosRestantes === 1 ? 'queda 1 intento' : `quedan ${String(intentosRestantes)} intentos`}.`,
      { detalles: { intentosRestantes } },
    );
  }
}

/** RN-32, CU-02 3.a: se acabaron los intentos del código; hay que pedir un correo nuevo. */
export class ErrorCodigoAgotado extends ErrorAplicacion {
  constructor() {
    super(
      409,
      'CODIGO_AGOTADO',
      'Se acabaron los intentos para escribir el código. Pide que te enviemos un correo nuevo.',
    );
  }
}

/**
 * CU-04 4.a: el enlace de recuperación ya se usó, se anuló al pedir otro, venció o no existe. Un mismo
 * mensaje para todos los casos: no revela cuál fue. El estudiante debe pedir un enlace nuevo.
 */
export class ErrorEnlaceNoVigente extends ErrorAplicacion {
  constructor() {
    super(
      409,
      'ENLACE_NO_VIGENTE',
      'Este enlace no sirve: ya se usó, venció o pediste otro. Pide un enlace nuevo para crear tu contraseña.',
    );
  }
}

/** CU-02b: el administrador intenta confirmar un correo que ya estaba verificado. */
export class ErrorYaVerificado extends ErrorAplicacion {
  constructor() {
    super(409, 'YA_VERIFICADO', 'El correo de este estudiante ya está verificado.');
  }
}

/** HU-43.1: por qué la tienda no deja activar la compra (`detalles.motivo` de COMPRA_NO_VALIDA). */
export type MotivoCompraNoValida =
  | 'no_encontrada'
  | 'otra_cuenta'
  | 'otro_producto'
  | 'otro_paquete'
  | 'firma_invalida'
  | 'revocada'
  | 'no_vigente';

const MENSAJE_COMPRA_NO_VALIDA: Record<MotivoCompraNoValida, string> = {
  no_encontrada: 'La tienda no encontró esta compra.',
  otra_cuenta: 'Esta compra se hizo para otra suscripción o cuenta.',
  otro_producto: 'Esta compra es de un producto distinto al plan elegido.',
  otro_paquete: 'Esta compra no es de la app Supera PAES.',
  firma_invalida: 'No pudimos comprobar que la compra venga de la tienda.',
  revocada: 'La tienda anuló o reembolsó esta compra.',
  no_vigente: 'Esta compra ya no está vigente en la tienda.',
};

/**
 * HU-43.1, 422 COMPRA_NO_VALIDA: la tienda no confirma la compra para esta suscripción. Solo cuenta lo
 * que responde la tienda: nunca se activa un plan porque la app diga que pagó. No se guarda nada.
 */
export class ErrorCompraNoValida extends ErrorAplicacion {
  constructor(readonly motivo: MotivoCompraNoValida) {
    super(422, 'COMPRA_NO_VALIDA', MENSAJE_COMPRA_NO_VALIDA[motivo], { detalles: { motivo } });
  }
}

/**
 * HU-43.1, 503 TIENDA_NO_DISPONIBLE: la tienda respondió con error, tardó más de 10 s o la API no pudo
 * autenticarse con ella. La suscripción queda igual y se puede reintentar.
 */
export class ErrorTiendaNoDisponible extends ErrorAplicacion {
  constructor() {
    super(
      503,
      'TIENDA_NO_DISPONIBLE',
      'No pudimos confirmar la compra con la tienda. Inténtalo de nuevo en unos minutos.',
    );
  }
}

export class ErrorDemasiadosIntentos extends ErrorAplicacion {
  constructor() {
    super(
      429,
      'DEMASIADOS_INTENTOS',
      'Hiciste demasiados intentos. Espera unos minutos y vuelve a probar.',
    );
  }
}

export class ErrorCuerpoDemasiadoGrande extends ErrorAplicacion {
  constructor() {
    super(413, 'CUERPO_DEMASIADO_GRANDE', 'El cuerpo de la solicitud es demasiado grande.');
  }
}

export class ErrorNoImplementado extends ErrorAplicacion {
  constructor(funcionalidad: string) {
    super(501, 'NO_IMPLEMENTADO', `Pendiente de implementación: ${funcionalidad}.`);
  }
}

export class ErrorBaseDeDatosNoDisponible extends ErrorAplicacion {
  constructor(causa?: unknown) {
    super(503, 'BASE_DE_DATOS_NO_DISPONIBLE', 'La base de datos no está disponible.', { causa });
  }
}
