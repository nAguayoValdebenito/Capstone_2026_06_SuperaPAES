import 'package:supera_paes/dominio/entidades/sesion_estudiante.dart';
import 'package:supera_paes/nucleo/ids.dart';

/// Campo `data` de POST /cuentas/registro y /cuentas/ingreso. También es lo
/// que se guarda cifrado en el teléfono.
class SesionEstudianteModelo {
  const SesionEstudianteModelo({
    required this.tokenAcceso,
    required this.tokenRenovacion,
    required this.id,
    required this.nombre,
    required this.correo,
    required this.correoVerificado,
  });

  factory SesionEstudianteModelo.desdeEntidad(SesionEstudiante sesion) =>
      SesionEstudianteModelo(
        tokenAcceso: sesion.tokenAcceso,
        tokenRenovacion: sesion.tokenRenovacion,
        id: sesion.estudiante.id,
        nombre: sesion.estudiante.nombre,
        correo: sesion.estudiante.correo,
        correoVerificado: sesion.estudiante.correoVerificado,
      );

  factory SesionEstudianteModelo.fromJson(Map<String, dynamic> json) {
    final estudiante = json['estudiante'] as Map<String, dynamic>;
    return SesionEstudianteModelo(
      tokenAcceso: json['tokenAcceso'] as String,
      tokenRenovacion: json['tokenRenovacion'] as String,
      id: leerId(estudiante['id']),
      nombre: estudiante['nombre'] as String,
      correo: estudiante['correo'] as String,
      correoVerificado: estudiante['correoVerificado'] as bool,
    );
  }

  final String tokenAcceso;
  final String tokenRenovacion;
  final int id;
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
