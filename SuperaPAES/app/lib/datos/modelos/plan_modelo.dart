import 'package:supera_paes/dominio/entidades/plan.dart';
import 'package:supera_paes/nucleo/ids.dart';

/// Lee `GET /suscripciones/planes` (HU-43).
abstract final class PlanModelo {
  static List<PlanOfrecido> planes(List<Object?> filas) => [
    for (final fila in filas) _plan(fila! as Map<String, dynamic>),
  ];

  static PlanOfrecido _plan(Map<String, dynamic> json) {
    final alcance = json['alcance'] as Map<String, dynamic>;
    final periodicidad = json['periodicidad'] as Map<String, dynamic>;
    return PlanOfrecido(
      id: leerId(json['id']),
      alcance: alcance['codigo'] as String,
      alcanceNombre: alcance['nombre'] as String,
      periodicidad: periodicidad['codigo'] as String,
      precioClp: json['precioClp'] as int,
    );
  }
}
