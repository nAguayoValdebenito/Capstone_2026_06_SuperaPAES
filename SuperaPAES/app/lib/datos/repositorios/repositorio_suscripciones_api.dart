import 'package:supera_paes/datos/fuentes/fuente_suscripciones_remota.dart';
import 'package:supera_paes/dominio/entidades/plan.dart';
import 'package:supera_paes/dominio/entidades/suscripcion_vigente.dart';
import 'package:supera_paes/dominio/repositorios/repositorio_suscripciones.dart';

/// Implementación de [RepositorioSuscripciones] que consulta la API.
class RepositorioSuscripcionesApi implements RepositorioSuscripciones {
  const RepositorioSuscripcionesApi(this._fuente);

  final FuenteSuscripcionesRemota _fuente;

  @override
  Future<List<PlanOfrecido>> planes() => _fuente.planes();

  @override
  Future<SuscripcionVigente?> actual() => _fuente.actual();
}
