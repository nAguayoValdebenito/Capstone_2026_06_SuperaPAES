import 'package:supera_paes/dominio/entidades/cupo_de_hoy.dart';
import 'package:supera_paes/dominio/entidades/resumen_invitaciones.dart';

/// Contrato del cupo y las invitaciones del estudiante de la sesión (HU-35 y
/// HU-46). Las rutas exigen la sesión de la app; los errores llegan como
/// `ErrorApi`.
abstract interface class RepositorioCupo {
  /// Cupo del día, preguntas extra, próximo reinicio y racha (A12).
  Future<CupoDeHoy> cupoDeHoy();

  /// Su código, su link de invitación, los registrados y los verificados
  /// (A38).
  Future<ResumenInvitaciones> misInvitaciones();
}
