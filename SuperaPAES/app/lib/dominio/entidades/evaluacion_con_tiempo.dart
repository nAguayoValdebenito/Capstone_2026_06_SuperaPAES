import 'package:supera_paes/dominio/entidades/practica.dart';

/// Lo que A25 y A26 muestran del mini-ensayo de una prueba antes de empezar
/// (HU-40.3, RN-04 y RN-05), sin crearlo ni gastar el uso gratis.
class DisponibilidadMiniEnsayo {
  const DisponibilidadMiniEnsayo({
    required this.pruebaId,
    required this.cantidad,
    required this.duracionMin,
    required this.ejes,
    required this.habilidades,
    required this.conPlan,
    required this.gratisRestantes,
    required this.disponible,
  });

  final int pruebaId;
  final int cantidad;
  final int duracionMin;

  /// Ejes que reparte, sin los que el curso todavía no ve (RN-28); Lectora
  /// reparte por habilidad y tiene 0.
  final int ejes;
  final int habilidades;

  /// Una suscripción cubre la prueba: sin límite de usos.
  final bool conPlan;

  /// Usos gratis que quedan este mes; `null` con plan.
  final int? gratisRestantes;
  final bool disponible;
}

/// Si el diagnóstico de una prueba se puede rendir este año escolar (HU-36).
class DisponibilidadDiagnostico {
  const DisponibilidadDiagnostico({
    required this.pruebaId,
    required this.anioEscolar,
    required this.disponible,
  });

  final int pruebaId;
  final int anioEscolar;

  /// `false`: ya lo rindió este año escolar.
  final bool disponible;
}

/// Una pregunta de una evaluación con tiempo (A27): sin la clave ni la
/// explicación hasta entregar (RN-06), con la alternativa que eligió.
class PreguntaConTiempo {
  const PreguntaConTiempo({
    required this.itemId,
    required this.orden,
    required this.enunciado,
    required this.alternativas,
    this.texto,
    this.elegidaId,
  });

  final int itemId;
  final int orden;
  final String enunciado;
  final TextoDeLectura? texto;
  final List<AlternativaVisible> alternativas;

  /// `null`: sin responder.
  final int? elegidaId;

  bool get respondida => elegidaId != null;

  PreguntaConTiempo conElegida(int? alternativaId) => PreguntaConTiempo(
    itemId: itemId,
    orden: orden,
    enunciado: enunciado,
    texto: texto,
    alternativas: alternativas,
    elegidaId: alternativaId,
  );
}

/// Una evaluación con tiempo recién iniciada (POST /evaluaciones/mini-ensayos)
/// o la abierta que se retoma: sus preguntas en orden y el tiempo que le
/// quedaba según el servidor (RN-21).
class EvaluacionConTiempo {
  const EvaluacionConTiempo({
    required this.id,
    required this.tipoNombre,
    required this.pruebaId,
    required this.preguntas,
    required this.segundosRestantes,
  });

  final int id;

  /// «Mini-ensayo», «Diagnóstico»...
  final String tipoNombre;
  final int pruebaId;
  final List<PreguntaConTiempo> preguntas;
  final int segundosRestantes;
}

/// La entrega (POST /evaluaciones/:id/entregar): con ella ya hay resultado.
class EntregaEvaluacion {
  const EntregaEvaluacion({required this.id, required this.estado});

  final int id;

  /// `entregada`, o `tiempo_agotado` si el tiempo se acabó antes.
  final String estado;
}
