import 'package:supera_paes/datos/fuentes/fuente_verificacion_remota.dart';
import 'package:supera_paes/dominio/repositorios/repositorio_verificacion.dart';

/// Implementación de [RepositorioVerificacion] que consulta la API.
class RepositorioVerificacionApi implements RepositorioVerificacion {
  const RepositorioVerificacionApi(this._fuente);

  final FuenteVerificacionRemota _fuente;

  @override
  Future<void> verificarCodigo(String codigo) =>
      _fuente.verificarCodigo(codigo);

  @override
  Future<ResultadoReenvio> reenviar() => _fuente.reenviar();
}
