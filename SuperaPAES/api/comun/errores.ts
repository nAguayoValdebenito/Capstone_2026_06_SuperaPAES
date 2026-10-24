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
