import 'package:supera_paes/dominio/entidades/progreso.dart';
import 'package:supera_paes/nucleo/ids.dart';

/// Lee el JSON de GET /evaluaciones/progreso (docs/contratos/HU-38.md).
abstract final class ProgresoModelo {
  static ProgresoEstudiante progreso(Map<String, dynamic> json) =>
      ProgresoEstudiante(
        pruebas: [
          for (final valor in json['pruebas'] as List<Object?>)
            _prueba(valor! as Map<String, dynamic>),
        ],
      );

  static double _numero(Object? valor) => (valor! as num).toDouble();

  static ProgresoPrueba _prueba(Map<String, dynamic> json) => ProgresoPrueba(
    pruebaId: leerId(json['pruebaId']),
    codigo: json['codigo'] as String,
    respondidas: json['respondidas'] as int,
    acierto: _numero(json['acierto']),
    aciertoPorDificultad: {
      for (final MapEntry(:key, :value)
          in (json['aciertoPorDificultad'] as Map<String, dynamic>).entries)
        key: _numero(value),
    },
    ejes: _grupos(json['ejes']),
    habilidades: _grupos(json['habilidades']),
    semanas: [
      for (final valor in json['semanas'] as List<Object?>)
        _semana(valor! as Map<String, dynamic>),
    ],
    ensayos: [
      for (final valor in json['ensayos'] as List<Object?>)
        _ensayo(valor! as Map<String, dynamic>),
    ],
  );

  static List<GrupoProgreso> _grupos(Object? lista) => [
    for (final valor in lista! as List<Object?>)
      if (valor case final Map<String, dynamic> json)
        GrupoProgreso(
          id: leerId(json['id']),
          nombre: json['nombre'] as String,
          respondidas: json['respondidas'] as int,
          aciertoPonderado: _numero(json['aciertoPonderado']),
          aReforzar: json['aReforzar'] == true,
        ),
  ];

  static SemanaProgreso _semana(Map<String, dynamic> json) => SemanaProgreso(
    lunes: DateTime.parse(json['semana'] as String),
    respondidas: json['respondidas'] as int,
    acierto: _numero(json['acierto']),
  );

  static EnsayoProgreso _ensayo(Map<String, dynamic> json) => EnsayoProgreso(
    id: leerId(json['id']),
    cerradaEn: DateTime.parse(json['cerradaEn'] as String),
    puntaje: json['puntaje'] as int,
  );
}
