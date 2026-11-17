import 'package:supera_paes/dominio/entidades/perfil_estudiante.dart';

/// Contrato del perfil del estudiante de la sesión (HU-29, CU-05). Todas las
/// rutas exigen la sesión de la app; los errores llegan como `ErrorApi`.
abstract interface class RepositorioPerfil {
  /// Cursos, pruebas con sus electivos y áreas de carrera con lo que sugiere
  /// cada una (A08 a A10).
  Future<OpcionesPerfil> opciones();

  Future<PerfilEstudiante> obtener();

  /// Guarda todo el perfil y confirma el curso. Un dato que no cumple las
  /// reglas llega como `ErrorApi` con el problema de su campo.
  Future<PerfilEstudiante> guardar(DatosPerfil datos);

  /// Confirma o corrige el curso al empezar el año escolar (A11).
  Future<PerfilEstudiante> confirmarCurso(String curso, {int? anioEgreso});
}
