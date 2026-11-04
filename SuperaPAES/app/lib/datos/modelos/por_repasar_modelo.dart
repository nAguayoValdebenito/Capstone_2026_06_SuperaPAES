import 'package:supera_paes/dominio/entidades/por_repasar.dart';
import 'package:supera_paes/nucleo/ids.dart';

/// Lee `GET /evaluaciones/repaso` (HU-39.1).
abstract final class PorRepasarModelo {
  static PorRepasar desde(Map<String, dynamic> json) => PorRepasar(
    total: json['total'] as int,
    limite: json['limite'] as int?,
    pruebas: [
      for (final valor in json['pruebas'] as List<Object?>)
        _prueba(valor! as Map<String, dynamic>),
    ],
  );

  static PruebaPorRepasar _prueba(Map<String, dynamic> json) =>
      PruebaPorRepasar(
        id: leerId(json['id']),
        codigo: json['codigo'] as String,
        nombre: json['nombre'] as String,
        preguntas: json['preguntas'] as int,
        ejes: [
          for (final valor in json['ejes'] as List<Object?>)
            _eje(valor! as Map<String, dynamic>),
        ],
      );

  static EjePorRepasar _eje(Map<String, dynamic> json) => EjePorRepasar(
    id: leerId(json['id']),
    nombre: json['nombre'] as String,
    preguntas: json['preguntas'] as int,
  );
}
