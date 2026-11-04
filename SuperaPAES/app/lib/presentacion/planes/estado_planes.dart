import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:supera_paes/datos/fuentes/fuente_suscripciones_remota.dart';
import 'package:supera_paes/datos/repositorios/repositorio_suscripciones_api.dart';
import 'package:supera_paes/dominio/entidades/plan.dart';
import 'package:supera_paes/dominio/entidades/suscripcion_vigente.dart';
import 'package:supera_paes/dominio/repositorios/repositorio_suscripciones.dart';
import 'package:supera_paes/presentacion/comunes/estado_cuenta.dart';

/// Planes y suscripción (HU-43 y HU-45): sus rutas exigen sesión, así que van
/// con el cliente que agrega el token y lo renueva.
final repositorioSuscripcionesProvider = Provider<RepositorioSuscripciones>(
  (ref) => RepositorioSuscripcionesApi(
    FuenteSuscripcionesRemota(ref.watch(clienteHttpConSesionProvider)),
  ),
);

/// Los planes que se ofrecen (A43).
final planesProvider = FutureProvider<List<PlanOfrecido>>(
  (ref) => ref.watch(repositorioSuscripcionesProvider).planes(),
);

/// La suscripción activa o en mora (A43 y A44); `null` en el plan Gratis o
/// sin sesión.
final suscripcionActualProvider = FutureProvider<SuscripcionVigente?>((
  ref,
) async {
  final estudianteId = ref.watch(
    sesionProvider.select((sesion) => sesion.value?.estudiante.id),
  );
  if (estudianteId == null) return null;
  return await ref.watch(repositorioSuscripcionesProvider).actual();
});
