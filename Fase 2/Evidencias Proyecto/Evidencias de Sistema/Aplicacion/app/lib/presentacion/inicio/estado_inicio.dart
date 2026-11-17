import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:supera_paes/datos/fuentes/fuente_cupo_remota.dart';
import 'package:supera_paes/datos/repositorios/repositorio_cupo_api.dart';
import 'package:supera_paes/dominio/entidades/cupo_de_hoy.dart';
import 'package:supera_paes/dominio/repositorios/repositorio_cupo.dart';
import 'package:supera_paes/presentacion/comunes/estado_cuenta.dart';

/// Cupo del estudiante (HU-35): su ruta exige sesión, así que va con el
/// cliente que agrega el token y lo renueva.
final repositorioCupoProvider = Provider<RepositorioCupo>(
  (ref) => RepositorioCupoApi(
    FuenteCupoRemota(ref.watch(clienteHttpConSesionProvider)),
  ),
);

/// Cupo del día y racha que muestra Inicio (A12); `null` sin sesión. Se
/// vuelve a leer al cambiar de estudiante, al verificar el correo (el máximo
/// sube a 20), al volver a la app y al deslizar hacia abajo en Inicio.
final cupoDeHoyProvider = FutureProvider<CupoDeHoy?>((ref) async {
  final (estudianteId, _) = ref.watch(
    sesionProvider.select(
      (sesion) => (
        sesion.value?.estudiante.id,
        sesion.value?.estudiante.correoVerificado,
      ),
    ),
  );
  if (estudianteId == null) return null;
  return await ref.watch(repositorioCupoProvider).cupoDeHoy();
});
