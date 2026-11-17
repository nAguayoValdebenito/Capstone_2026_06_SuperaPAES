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

/// Suscripciones sin red: por defecto, los planes de RN-05, el plan Gratis y
/// el modo de pruebas apagado.
class RepositorioSuscripcionesFalso implements RepositorioSuscripciones {
  RepositorioSuscripcionesFalso({this.suscripcion, this.modoPruebas = false});

  SuscripcionVigente? suscripcion;
  ErrorApi? error;
  bool modoPruebas;

  /// Si se indica, activar la simulada falla con este error.
  ErrorApi? errorSimulada;

  /// Cada simulada pedida: el plan y la prueba.
  final List<({int planId, int? pruebaId})> simuladas = [];

  @override
  Future<OfertaDePlanes> oferta() async {
    if (error case final fallo?) throw fallo;
    return OfertaDePlanes(planes: planesDeEjemplo, modoPruebas: modoPruebas);
  }

  @override
  Future<SuscripcionVigente?> actual() async {
    if (error case final fallo?) throw fallo;
    return suscripcion;
  }

  @override
  Future<void> activarSimulada({required int planId, int? pruebaId}) async {
    simuladas.add((planId: planId, pruebaId: pruebaId));
    if (errorSimulada case final fallo?) throw fallo;
    final plan = planesDeEjemplo.firstWhere((p) => p.id == planId);
    suscripcion = SuscripcionVigente(
      enMora: false,
      plan: plan.alcanceNombre,
      periodicidad: plan.periodicidad,
      tienda: Tienda.prueba,
      periodoFin: DateTime(2026, 12, 16),
      alcance: plan.alcance,
      pruebasIncluidas: [?pruebaId],
      coberturaVigente: true,
    );
  }
}
