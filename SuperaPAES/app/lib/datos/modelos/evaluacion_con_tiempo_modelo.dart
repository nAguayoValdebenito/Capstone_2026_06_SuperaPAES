import 'package:supera_paes/datos/modelos/pregunta_modelo.dart';
import 'package:supera_paes/dominio/entidades/evaluacion_con_tiempo.dart';
import 'package:supera_paes/nucleo/ids.dart';

/// Lee el JSON de las evaluaciones con tiempo (docs/contratos/HU-40.md): la
/// disponibilidad del mini-ensayo y del diagnóstico, el inicio, sus
/// preguntas y la entrega.
abstract final class EvaluacionConTiempoModelo {
  static DisponibilidadMiniEnsayo disponibilidadMini(
    Map<String, dynamic> json,
  ) => DisponibilidadMiniEnsayo(
    pruebaId: leerId(json['pruebaId']),
    cantidad: json['cantidad'] as int,
    duracionMin: json['duracionMin'] as int,
    ejes: json['ejes'] as int,
    habilidades: json['habilidades'] as int,
    conPlan: json['conPlan'] == true,
    gratisRestantes: json['gratisRestantes'] as int?,
    disponible: json['disponible'] == true,
  );

  static DisponibilidadDiagnostico disponibilidadDiagnostico(
    Map<String, dynamic> json,
  ) => DisponibilidadDiagnostico(
    pruebaId: leerId(json['pruebaId']),
    cantidad: json['cantidad'] as int,
    duracionMin: json['duracionMin'] as int,
    ejes: json['ejes'] as int,
    habilidades: json['habilidades'] as int,
    anioEscolar: json['anioEscolar'] as int,
    disponible: json['disponible'] == true,
  );

  /// `data` de POST /evaluaciones/mini-ensayos o /diagnosticos: recién
  /// empezado, le queda toda la duración.
  static EvaluacionConTiempo iniciada(
    Map<String, dynamic> json, {
    required String tipoNombre,
  }) => EvaluacionConTiempo(
    id: leerId(json['id']),
    tipoNombre: tipoNombre,
    pruebaId: leerId(json['pruebaId']),
    preguntas: preguntas(json['preguntas']),
    segundosRestantes: (json['duracionMin'] as int) * 60,
  );

  /// Las preguntas del inicio y de GET /evaluaciones/abierta, en orden.
  static List<PreguntaConTiempo> preguntas(Object? lista) => [
    for (final valor in lista as List<Object?>? ?? const [])
      _pregunta(valor! as Map<String, dynamic>),
  ]..sort((a, b) => a.orden.compareTo(b.orden));

  static PreguntaConTiempo _pregunta(Map<String, dynamic> json) =>
      PreguntaConTiempo(
        itemId: leerId(json['id']),
        orden: json['orden'] as int,
        enunciado: json['enunciado'] as String,
        texto: PreguntaModelo.textoDeLectura(json['texto']),
        // Como en la práctica, por letra.
        alternativas: PreguntaModelo.alternativas(json['alternativas'])
          ..sort((a, b) => a.letra.compareTo(b.letra)),
        elegidaId: switch (json['alternativaElegidaId']) {
          null => null,
          final id => leerId(id),
        },
      );

  static EntregaEvaluacion entrega(Map<String, dynamic> json) =>
      EntregaEvaluacion(
        id: leerId(json['id']),
        estado: json['estado'] as String,
      );
}
