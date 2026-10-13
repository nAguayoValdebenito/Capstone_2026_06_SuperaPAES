import 'package:supera_paes/datos/fuentes/fuente_salud_remota.dart';
import 'package:supera_paes/dominio/entidades/estado_salud.dart';
import 'package:supera_paes/dominio/repositorios/repositorio_salud.dart';

/// Implementación de [RepositorioSalud] que consulta la API.
class RepositorioSaludApi implements RepositorioSalud {
  const RepositorioSaludApi(this._fuente);

  final FuenteSaludRemota _fuente;

  @override
  Future<EstadoSalud> obtenerEstado() async =>
      (await _fuente.obtener()).aEntidad();
}
