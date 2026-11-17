import 'package:supera_paes/dominio/entidades/sesion_estudiante.dart';

/// Dónde queda guardada la sesión entre una apertura de la app y la
/// siguiente.
abstract interface class AlmacenSesion {
  /// La sesión guardada, o `null` si no hay o no se puede leer.
  Future<SesionEstudiante?> leer();

  Future<void> guardar(SesionEstudiante sesion);

  Future<void> borrar();
}
