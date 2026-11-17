import 'package:supera_paes/dominio/entidades/progreso.dart';

/// Contrato del progreso del estudiante de la sesión (HU-38). La ruta exige
/// la sesión de la app; los errores llegan como `ErrorApi`.
abstract interface class RepositorioProgreso {
  Future<ProgresoEstudiante> obtener();
}
