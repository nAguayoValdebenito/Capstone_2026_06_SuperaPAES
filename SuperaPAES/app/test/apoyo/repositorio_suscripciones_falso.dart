import 'package:supera_paes/dominio/entidades/plan.dart';
import 'package:supera_paes/dominio/entidades/suscripcion_vigente.dart';
import 'package:supera_paes/dominio/repositorios/repositorio_suscripciones.dart';
import 'package:supera_paes/nucleo/errores.dart';

/// Los cuatro planes de RN-05.
const List<PlanOfrecido> planesDeEjemplo = [
  PlanOfrecido(
    id: 1,
    alcance: 'una_prueba',
    alcanceNombre: 'Una prueba',
    periodicidad: 'mensual',
    precioClp: 1990,
  ),
  PlanOfrecido(
    id: 2,
    alcance: 'una_prueba',
    alcanceNombre: 'Una prueba',
    periodicidad: 'anual',
    precioClp: 15990,
  ),
  PlanOfrecido(
    id: 3,
    alcance: 'todas',
    alcanceNombre: 'Todas las pruebas',
    periodicidad: 'mensual',
    precioClp: 2990,
  ),
  PlanOfrecido(
    id: 4,
    alcance: 'todas',
    alcanceNombre: 'Todas las pruebas',
    periodicidad: 'anual',
    precioClp: 23990,
  ),
];

/// La suscripción del boceto A44.
final SuscripcionVigente suscripcionDeEjemplo = SuscripcionVigente(
  enMora: false,
  plan: 'Todas las pruebas',
  periodicidad: 'mensual',
  tienda: Tienda.googlePlay,
  periodoFin: DateTime(2026, 11, 20),
  gestionUrl:
      'https://play.google.com/store/account/subscriptions?sku=todas_mensual&package=cl.superapaes.app',
);

/// Suscripciones sin red: por defecto, los planes de RN-05 y el plan Gratis.
class RepositorioSuscripcionesFalso implements RepositorioSuscripciones {
  RepositorioSuscripcionesFalso({this.suscripcion});

  SuscripcionVigente? suscripcion;
  ErrorApi? error;

  @override
  Future<List<PlanOfrecido>> planes() async {
    if (error case final fallo?) throw fallo;
    return planesDeEjemplo;
  }

  @override
  Future<SuscripcionVigente?> actual() async {
    if (error case final fallo?) throw fallo;
    return suscripcion;
  }
}
