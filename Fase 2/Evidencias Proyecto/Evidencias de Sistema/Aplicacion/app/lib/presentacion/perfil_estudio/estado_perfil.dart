import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:supera_paes/datos/fuentes/fuente_perfil_remota.dart';
import 'package:supera_paes/datos/repositorios/repositorio_perfil_api.dart';
import 'package:supera_paes/dominio/entidades/perfil_estudiante.dart';
import 'package:supera_paes/dominio/repositorios/repositorio_perfil.dart';
import 'package:supera_paes/presentacion/comunes/estado_cuenta.dart';

/// Perfil del estudiante (HU-29): sus rutas exigen sesión, así que van con
/// el cliente que agrega el token y lo renueva.
final repositorioPerfilProvider = Provider<RepositorioPerfil>(
  (ref) => RepositorioPerfilApi(
    FuentePerfilRemota(ref.watch(clienteHttpConSesionProvider)),
  ),
);

/// Cursos, pruebas y áreas de carrera de las pantallas del perfil (A08 a A10).
final opcionesPerfilProvider = FutureProvider<OpcionesPerfil>(
  (ref) => ref.watch(repositorioPerfilProvider).opciones(),
);

/// Perfil del estudiante de la sesión; `null` sin sesión. Se vuelve a leer
/// cuando cambia el estudiante (al ingresar con otra cuenta).
class EstadoPerfil extends AsyncNotifier<PerfilEstudiante?> {
  RepositorioPerfil get _repositorio => ref.read(repositorioPerfilProvider);

  @override
  Future<PerfilEstudiante?> build() async {
    final estudianteId = ref.watch(
      sesionProvider.select((sesion) => sesion.value?.estudiante.id),
    );
    if (estudianteId == null) return null;
    return await _repositorio.obtener();
  }

  /// Guarda el perfil (CU-05 paso 7). Un error de la API llega al llamador
  /// como `ErrorApi` y el perfil anterior queda igual.
  Future<void> guardar(DatosPerfil datos) async {
    state = AsyncData(await _repositorio.guardar(datos));
  }

  /// Confirma o corrige el curso al empezar el año escolar (A11).
  Future<void> confirmarCurso(String curso, {int? anioEgreso}) async {
    state = AsyncData(
      await _repositorio.confirmarCurso(curso, anioEgreso: anioEgreso),
    );
  }
}

final perfilProvider = AsyncNotifierProvider<EstadoPerfil, PerfilEstudiante?>(
  EstadoPerfil.new,
);

/// Año escolar de una fecha: empieza en marzo (RN-24).
int anioEscolar(DateTime fecha) =>
    fecha.month < DateTime.march ? fecha.year - 1 : fecha.year;

/// Años que le faltan para egresar a quien está en el curso (4° medio = 0).
int? aniosParaEgresar(String curso) => switch (curso) {
  '1M' => 3,
  '2M' => 2,
  '3M' => 1,
  '4M' => 0,
  _ => null,
};
