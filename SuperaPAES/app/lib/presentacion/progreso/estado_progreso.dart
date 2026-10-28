import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:supera_paes/datos/fuentes/fuente_progreso_remota.dart';
import 'package:supera_paes/datos/repositorios/repositorio_progreso_api.dart';
import 'package:supera_paes/dominio/entidades/progreso.dart';
import 'package:supera_paes/dominio/repositorios/repositorio_progreso.dart';
import 'package:supera_paes/presentacion/comunes/estado_cuenta.dart';

/// Progreso del estudiante (HU-38): su ruta exige sesión, así que va con el
/// cliente que agrega el token y lo renueva.
final repositorioProgresoProvider = Provider<RepositorioProgreso>(
  (ref) => RepositorioProgresoApi(
    FuenteProgresoRemota(ref.watch(clienteHttpConSesionProvider)),
  ),
);

/// El progreso de la pestaña Progreso (A35); `null` sin sesión. Se vuelve a
/// leer al cambiar de estudiante, al cerrar una práctica y al deslizar hacia
/// abajo en Progreso.
final progresoProvider = FutureProvider<ProgresoEstudiante?>((ref) async {
  final estudianteId = ref.watch(
    sesionProvider.select((sesion) => sesion.value?.estudiante.id),
  );
  if (estudianteId == null) return null;
  return await ref.watch(repositorioProgresoProvider).obtener();
});
