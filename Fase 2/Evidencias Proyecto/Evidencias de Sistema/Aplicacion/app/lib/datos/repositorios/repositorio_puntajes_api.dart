import 'package:supera_paes/datos/fuentes/fuente_puntajes_remota.dart';
import 'package:supera_paes/dominio/entidades/puntajes_paes.dart';
import 'package:supera_paes/dominio/repositorios/repositorio_puntajes.dart';

/// Implementación de [RepositorioPuntajes] que consulta la API.
class RepositorioPuntajesApi implements RepositorioPuntajes {
  const RepositorioPuntajesApi(this._fuente);

  final FuentePuntajesRemota _fuente;

  @override
  Future<PuntajesPaes> obtener() => _fuente.obtener();

  @override
  Future<PuntajesPaes> otorgarPermiso(int documentoId) =>
      _fuente.otorgarPermiso(documentoId);

  @override
  Future<PuntajesPaes> retirarPermiso() => _fuente.retirarPermiso();

  @override
  Future<PuntajesPaes> guardar(DatosPuntaje datos) => _fuente.guardar(datos);

  @override
  Future<PuntajesPaes> borrar(int puntajeId) => _fuente.borrar(puntajeId);
}
