import 'package:supera_paes/datos/fuentes/fuente_perfil_remota.dart';
import 'package:supera_paes/dominio/entidades/perfil_estudiante.dart';
import 'package:supera_paes/dominio/repositorios/repositorio_perfil.dart';

/// Implementación de [RepositorioPerfil] que consulta la API.
class RepositorioPerfilApi implements RepositorioPerfil {
  const RepositorioPerfilApi(this._fuente);

  final FuentePerfilRemota _fuente;

  @override
  Future<OpcionesPerfil> opciones() => _fuente.opciones();

  @override
  Future<PerfilEstudiante> obtener() => _fuente.obtener();

  @override
  Future<PerfilEstudiante> guardar(DatosPerfil datos) => _fuente.guardar(datos);

  @override
  Future<PerfilEstudiante> confirmarCurso(String curso, {int? anioEgreso}) =>
      _fuente.confirmarCurso(curso, anioEgreso);
}
