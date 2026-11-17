import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supera_paes/datos/fuentes/fuente_avisos_remota.dart';
import 'package:supera_paes/datos/repositorios/repositorio_avisos_api.dart';
import 'package:supera_paes/dominio/entidades/aviso_error.dart';
import 'package:supera_paes/dominio/repositorios/repositorio_avisos.dart';
import 'package:supera_paes/presentacion/comunes/estado_cuenta.dart';

/// Avisos de error (HU-37): sus rutas exigen sesión, así que va con el
/// cliente que agrega el token y lo renueva.
final repositorioAvisosProvider = Provider<RepositorioAvisos>(
  (ref) => RepositorioAvisosApi(
    FuenteAvisosRemota(ref.watch(clienteHttpConSesionProvider)),
  ),
);

/// Los motivos de A23. Se piden al abrir la hoja.
final FutureProvider<List<MotivoAviso>> motivosAvisoProvider =
    FutureProvider.autoDispose<List<MotivoAviso>>(
      (ref) => ref.watch(repositorioAvisosProvider).motivos(),
    );
