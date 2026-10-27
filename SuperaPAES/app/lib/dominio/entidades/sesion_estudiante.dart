/// Datos mínimos del estudiante que devuelven el registro y el ingreso.
class Estudiante {
  const Estudiante({
    required this.id,
    required this.nombre,
    required this.correo,
    required this.correoVerificado,
  });

  final int id;
  final String nombre;
  final String correo;
  final bool correoVerificado;
}

/// Par de tokens que entrega la API al ingresar y al renovar.
typedef TokensSesion = ({String tokenAcceso, String tokenRenovacion});

/// Sesión abierta de la app: los dos tokens y el estudiante.
class SesionEstudiante {
  const SesionEstudiante({
    required this.tokenAcceso,
    required this.tokenRenovacion,
    required this.estudiante,
  });

  /// JWT de 15 minutos que va en cada petición protegida.
  final String tokenAcceso;

  /// Pide un token de acceso nuevo; cambia en cada renovación (30 días).
  final String tokenRenovacion;
  final Estudiante estudiante;

  /// La misma sesión con los tokens de una renovación, que no trae al
  /// estudiante.
  SesionEstudiante conTokens(TokensSesion tokens) => SesionEstudiante(
    tokenAcceso: tokens.tokenAcceso,
    tokenRenovacion: tokens.tokenRenovacion,
    estudiante: estudiante,
  );

  /// La misma sesión con el correo del estudiante verificado (HU-05).
  SesionEstudiante conCorreoVerificado() => SesionEstudiante(
    tokenAcceso: tokenAcceso,
    tokenRenovacion: tokenRenovacion,
    estudiante: Estudiante(
      id: estudiante.id,
      nombre: estudiante.nombre,
      correo: estudiante.correo,
      correoVerificado: true,
    ),
  );
}
