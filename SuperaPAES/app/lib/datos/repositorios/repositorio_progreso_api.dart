import 'package:supera_paes/datos/fuentes/fuente_progreso_remota.dart';
import 'package:supera_paes/dominio/entidades/progreso.dart';
import 'package:supera_paes/dominio/repositorios/repositorio_progreso.dart';

/// Implementación de [RepositorioProgreso] que consulta la API.
class RepositorioProgresoApi implements RepositorioProgreso {
  const RepositorioProgresoApi(this._fuente);

  final FuenteProgresoRemota _fuente;

  @override
  Future<ProgresoEstudiante> obtener() => _fuente.obtener();
}
