import 'package:supera_paes/dominio/entidades/plan.dart';
import 'package:supera_paes/dominio/entidades/suscripcion_vigente.dart';

/// Contrato de los planes y la suscripción del estudiante de la sesión
/// (HU-43, HU-45). Las rutas exigen la sesión de la app; los errores llegan
/// como `ErrorApi`.
abstract interface class RepositorioSuscripciones {
  /// Los planes activos, con su precio (A43).
  Future<List<PlanOfrecido>> planes();

  /// La suscripción activa o en mora (A44); `null` en el plan Gratis.
  Future<SuscripcionVigente?> actual();
}
