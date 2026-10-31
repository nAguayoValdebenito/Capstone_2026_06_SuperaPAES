import 'package:supera_paes/datos/fuentes/fuente_resultados_remota.dart';
import 'package:supera_paes/dominio/entidades/resultado_evaluacion.dart';
import 'package:supera_paes/dominio/repositorios/repositorio_resultados.dart';

/// Implementación de [RepositorioResultados] que consulta la API.
class RepositorioResultadosApi implements RepositorioResultados {
  const RepositorioResultadosApi(this._fuente);

  final FuenteResultadosRemota _fuente;

  @override
  Future<ResultadoEvaluacion> obtenerResultado(int evaluacionId) =>
      _fuente.resultado(evaluacionId);

  @override
  Future<List<PreguntaRevisada>> obtenerRevision(int evaluacionId) =>
      _fuente.revision(evaluacionId);
}
