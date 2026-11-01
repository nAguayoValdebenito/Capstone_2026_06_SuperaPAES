import 'package:supera_paes/dominio/entidades/evaluacion_con_tiempo.dart';

/// Contrato de las evaluaciones con tiempo del estudiante de la sesión
/// (HU-36, HU-40, CU-10). Las rutas exigen la sesión de la app; los errores
/// llegan como `ErrorApi`.
abstract interface class RepositorioEvaluaciones {
  /// Preguntas, minutos y uso gratis del mes del mini-ensayo de la prueba
  /// (A25 y A26), sin crearlo.
  Future<DisponibilidadMiniEnsayo> disponibilidadMiniEnsayo(int pruebaId);

  /// Si el diagnóstico de la prueba se puede rendir este año escolar.
  Future<DisponibilidadDiagnostico> disponibilidadDiagnostico(int pruebaId);

  /// Arma el mini-ensayo y fija su hora de término (CU-10 pasos 3 y 4). Sin
  /// el uso gratis llega `USO_GRATIS_AGOTADO`; con otra evaluación con
  /// tiempo abierta, `EVALUACION_CON_TIEMPO_ABIERTA`; sin banco suficiente,
  /// `SIN_PREGUNTAS_SUFICIENTES`.
  Future<EvaluacionConTiempo> iniciarMiniEnsayo(int pruebaId);

  /// Guarda o cambia la respuesta sin corregirla (CU-10 paso 6). Vencido el
  /// tiempo llega `EVALUACION_CERRADA`.
  Future<void> guardarRespuesta(
    int evaluacionId,
    int itemId,
    int alternativaId,
  );

  /// Cierra y corrige la evaluación (CU-10 paso 8); repetirla devuelve el
  /// mismo cierre.
  Future<EntregaEvaluacion> entregar(int evaluacionId);
}
