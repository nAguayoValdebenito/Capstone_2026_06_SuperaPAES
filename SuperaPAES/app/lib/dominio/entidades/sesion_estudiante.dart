/// Datos mínimos del estudiante que devuelven el registro y el ingreso.
class Estudiante {
  const Estudiante({
    required this.id,
    required this.nombre,
    required this.correo,
    required this.correoVerificado,
  });

  final String id;
  final String nombre;
  final String correo;
  final bool correoVerificado;
}

/// Sesión abierta de la app: los dos tokens y el estudiante.
class SesionEstudiante {
  const SesionEstudiante({
    required this.tokenAcceso,
    required this.tokenRenovacion,
    required this.estudiante,
  });

  final String tokenAcceso;
  final String tokenRenovacion;
  final Estudiante estudiante;
}
