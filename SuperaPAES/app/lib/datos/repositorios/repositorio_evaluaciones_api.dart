import 'package:supera_paes/datos/fuentes/fuente_evaluaciones_remota.dart';
import 'package:supera_paes/dominio/entidades/evaluacion_con_tiempo.dart';
import 'package:supera_paes/dominio/repositorios/repositorio_evaluaciones.dart';

/// Implementación de [RepositorioEvaluaciones] que consulta la API.
class RepositorioEvaluacionesApi implements RepositorioEvaluaciones {
  const RepositorioEvaluacionesApi(this._fuente);

  final FuenteEvaluacionesRemota _fuente;

  @override
  Future<DisponibilidadMiniEnsayo> disponibilidadMiniEnsayo(int pruebaId) =>
      _fuente.disponibilidadMiniEnsayo(pruebaId);

  @override
  Future<DisponibilidadDiagnostico> disponibilidadDiagnostico(int pruebaId) =>
      _fuente.disponibilidadDiagnostico(pruebaId);

  @override
  Future<EvaluacionConTiempo> iniciarMiniEnsayo(int pruebaId) =>
      _fuente.iniciarMiniEnsayo(pruebaId);

  @override
  Future<void> guardarRespuesta(
    int evaluacionId,
    int itemId,
    int alternativaId,
  ) => _fuente.guardarRespuesta(evaluacionId, itemId, alternativaId);

  @override
  Future<EntregaEvaluacion> entregar(int evaluacionId) =>
      _fuente.entregar(evaluacionId);
}
