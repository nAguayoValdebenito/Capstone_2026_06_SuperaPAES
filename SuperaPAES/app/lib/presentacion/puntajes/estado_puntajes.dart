import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:supera_paes/datos/fuentes/fuente_puntajes_remota.dart';
import 'package:supera_paes/datos/repositorios/repositorio_puntajes_api.dart';
import 'package:supera_paes/dominio/entidades/puntajes_paes.dart';
import 'package:supera_paes/dominio/repositorios/repositorio_puntajes.dart';
import 'package:supera_paes/presentacion/comunes/estado_cuenta.dart';

/// Puntajes PAES (HU-41): sus rutas exigen sesión, así que van con el
/// cliente que agrega el token y lo renueva.
final repositorioPuntajesProvider = Provider<RepositorioPuntajes>(
  (ref) => RepositorioPuntajesApi(
    FuentePuntajesRemota(ref.watch(clienteHttpConSesionProvider)),
  ),
);

/// El permiso y los puntajes de A41 y de Progreso; `null` sin sesión. Cada
/// cambio deja lo que respondió el servidor. Un error de la API llega al
/// llamador como `ErrorApi` y lo anterior queda igual.
class EstadoPuntajes extends AsyncNotifier<PuntajesPaes?> {
  RepositorioPuntajes get _repositorio => ref.read(repositorioPuntajesProvider);

  @override
  Future<PuntajesPaes?> build() async {
    final estudianteId = ref.watch(
      sesionProvider.select((sesion) => sesion.value?.estudiante.id),
    );
    if (estudianteId == null) return null;
    return await _repositorio.obtener();
  }

  Future<void> _cambiar(Future<PuntajesPaes> cambio) async {
    state = AsyncData(await cambio);
  }

  Future<void> otorgarPermiso(int documentoId) =>
      _cambiar(_repositorio.otorgarPermiso(documentoId));

  /// RN-16: el servidor borra todos los puntajes.
  Future<void> retirarPermiso() => _cambiar(_repositorio.retirarPermiso());

  Future<void> guardar(DatosPuntaje datos) =>
      _cambiar(_repositorio.guardar(datos));

  Future<void> borrar(int puntajeId) =>
      _cambiar(_repositorio.borrar(puntajeId));
}

final puntajesProvider = AsyncNotifierProvider<EstadoPuntajes, PuntajesPaes?>(
  EstadoPuntajes.new,
);
