import 'package:supera_paes/dominio/entidades/sesion_estudiante.dart';

/// Campo `data` de POST /cuentas/registro (y del ingreso de la app).
class SesionEstudianteModelo {
  const SesionEstudianteModelo({
    required this.tokenAcceso,
    required this.tokenRenovacion,
    required this.id,
    required this.nombre,
    required this.correo,
    required this.correoVerificado,
  });

  factory SesionEstudianteModelo.fromJson(Map<String, dynamic> json) {
    final estudiante = json['estudiante'] as Map<String, dynamic>;
    return SesionEstudianteModelo(
      tokenAcceso: json['tokenAcceso'] as String,
      tokenRenovacion: json['tokenRenovacion'] as String,
      id: estudiante['id'] as String,
      nombre: estudiante['nombre'] as String,
      correo: estudiante['correo'] as String,
      correoVerificado: estudiante['correoVerificado'] as bool,
    );
  }

  final String tokenAcceso;
  final String tokenRenovacion;
  final String id;
  final String nombre;
  final String correo;
  final bool correoVerificado;

  Map<String, dynamic> toJson() => {
    'tokenAcceso': tokenAcceso,
    'tokenRenovacion': tokenRenovacion,
    'estudiante': {
      'id': id,
      'nombre': nombre,
      'correo': correo,
      'correoVerificado': correoVerificado,
    },
  };

  SesionEstudiante aEntidad() => SesionEstudiante(
    tokenAcceso: tokenAcceso,
    tokenRenovacion: tokenRenovacion,
    estudiante: Estudiante(
      id: id,
      nombre: nombre,
      correo: correo,
      correoVerificado: correoVerificado,
    ),
  );
}
