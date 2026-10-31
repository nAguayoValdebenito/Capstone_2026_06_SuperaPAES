import 'package:supera_paes/dominio/entidades/resultado_evaluacion.dart';

/// Contrato del resultado y la revisión de una evaluación cerrada del
/// estudiante de la sesión (HU-61). Las rutas exigen la sesión de la app; los
/// errores llegan como `ErrorApi`.
abstract interface class RepositorioResultados {
  Future<ResultadoEvaluacion> obtenerResultado(int evaluacionId);

  /// Las preguntas en su orden. En la práctica y el repaso, solo las
  /// respondidas (RN-22).
  Future<List<PreguntaRevisada>> obtenerRevision(int evaluacionId);
}
