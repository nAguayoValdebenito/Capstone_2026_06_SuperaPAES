import 'package:supera_paes/dominio/entidades/estado_salud.dart';

/// Campo `data` de GET /api/v1/salud.
class EstadoSaludModelo {
  const EstadoSaludModelo({required this.estado, required this.baseDeDatos});

  factory EstadoSaludModelo.fromJson(Map<String, dynamic> json) {
    return EstadoSaludModelo(
      estado: json['estado'] as String,
      baseDeDatos: json['baseDeDatos'] as String,
    );
  }

  final String estado;
  final String baseDeDatos;

  Map<String, dynamic> toJson() => {
    'estado': estado,
    'baseDeDatos': baseDeDatos,
  };

  EstadoSalud aEntidad() =>
      EstadoSalud(estado: estado, baseDeDatos: baseDeDatos);
}
