import 'package:supera_paes/dominio/entidades/cupo_de_hoy.dart';

/// Contrato del cupo del estudiante de la sesión (HU-35). La ruta exige la
/// sesión de la app; los errores llegan como `ErrorApi`.
abstract interface class RepositorioCupo {
  /// Cupo del día, preguntas extra, próximo reinicio y racha (A12).
  Future<CupoDeHoy> cupoDeHoy();
}
