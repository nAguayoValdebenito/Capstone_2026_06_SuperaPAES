import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:supera_paes/dominio/entidades/perfil_estudiante.dart';
import 'package:supera_paes/presentacion/comunes/estado_cuenta.dart';

/// Para qué se abren los pasos del perfil.
enum ModoPerfil {
  /// Primer ingreso: los tres pasos y, al guardar, a Inicio (CU-05).
  bienvenida,

  /// Desde «Editar» en Perfil (A37): los tres pasos y, al guardar, a Perfil.
  edicion,

  /// Desde «Corregir mi curso» en A11: solo el curso.
  correccion,
}

/// RN-25: hasta tres áreas de carrera.
const int maximoAreasCarrera = 3;

/// Lo que el estudiante va eligiendo en A08 a A10 antes de guardar.
class Borrador {
  const Borrador({
    this.modo = ModoPerfil.bienvenida,
    this.curso,
    this.anioEgreso,
    this.areas = const [],
    this.areasConSugerencias,
    this.pruebas = const {},
    this.electivoId,
    this.pruebaReforzarId,
  });

  /// El borrador de un perfil ya guardado, para editarlo o corregirlo.
  factory Borrador.desde(ModoPerfil modo, PerfilEstudiante perfil) => Borrador(
    modo: modo,
    curso: perfil.curso?.codigo,
    anioEgreso: perfil.curso?.esEgresado ?? false ? perfil.anioEgreso : null,
    areas: perfil.areasCarrera,
    // Las pruebas guardadas ya son las elegidas para estas áreas.
    areasConSugerencias: perfil.areasCarrera,
    pruebas: perfil.pruebas.toSet(),
    electivoId: perfil.electivoId,
    pruebaReforzarId: perfil.pruebaReforzarId,
  );

  final ModoPerfil modo;
  final String? curso;
  final int? anioEgreso;
  final List<int> areas;

  /// Áreas cuyas sugerencias ya se aplicaron a las pruebas: si no cambian,
  /// volver a A10 no borra lo que el estudiante eligió.
  final List<int>? areasConSugerencias;
  final Set<int> pruebas;
  final int? electivoId;
  final int? pruebaReforzarId;

  bool get esEgresado => curso == Curso.egresado;

  Borrador copiar({
    String? curso,
    int? Function()? anioEgreso,
    List<int>? areas,
    List<int>? Function()? areasConSugerencias,
    Set<int>? pruebas,
    int? Function()? electivoId,
    int? Function()? pruebaReforzarId,
  }) => Borrador(
    modo: modo,
    curso: curso ?? this.curso,
    anioEgreso: anioEgreso == null ? this.anioEgreso : anioEgreso(),
    areas: areas ?? this.areas,
    areasConSugerencias: areasConSugerencias == null
        ? this.areasConSugerencias
        : areasConSugerencias(),
    pruebas: pruebas ?? this.pruebas,
    electivoId: electivoId == null ? this.electivoId : electivoId(),
    pruebaReforzarId: pruebaReforzarId == null
        ? this.pruebaReforzarId
        : pruebaReforzarId(),
  );

  /// Lo que se envía a la API, en el orden de las opciones.
  DatosPerfil datos(OpcionesPerfil opciones) {
    final pruebasEnOrden = [
      for (final prueba in opciones.pruebas)
        if (pruebas.contains(prueba.id)) prueba.id,
    ];
    final rindeCiencias = opciones.pruebas.any(
      (prueba) => prueba.esCiencias && pruebas.contains(prueba.id),
    );
    return DatosPerfil(
      curso: curso!,
      anioEgreso: esEgresado ? anioEgreso : null,
      pruebas: pruebasEnOrden,
      electivoId: rindeCiencias ? electivoId : null,
      pruebaReforzarId: pruebas.contains(pruebaReforzarId)
          ? pruebaReforzarId
          : null,
      areasCarrera: areas,
    );
  }
}

/// Borrador de los pasos del perfil. Vive mientras la app está abierta: A11
/// y Perfil lo preparan antes de abrir el primer paso. Vuelve a la
/// bienvenida vacía cuando cambia el estudiante de la sesión.
class EstadoBorrador extends Notifier<Borrador> {
  @override
  Borrador build() {
    ref.watch(sesionProvider.select((sesion) => sesion.value?.estudiante.id));
    return const Borrador();
  }

  /// Empieza un borrador: vacío en la bienvenida, o con el perfil guardado.
  void iniciar(ModoPerfil modo, [PerfilEstudiante? perfil]) {
    state = perfil == null
        ? Borrador(modo: modo)
        : Borrador.desde(modo, perfil);
  }

  void elegirCurso(String curso) => state = state.copiar(curso: curso);

  void cambiarAnioEgreso(int? anio) =>
      state = state.copiar(anioEgreso: () => anio);

  /// Marca o desmarca un área. Con tres marcadas no agrega otra y devuelve
  /// `false` (CU-05 4.b).
  bool alternarArea(int id) {
    final areas = [...state.areas];
    if (areas.remove(id)) {
      state = state.copiar(areas: areas);
      return true;
    }
    if (areas.length >= maximoAreasCarrera) return false;
    state = state.copiar(areas: [...areas, id]);
    return true;
  }

  void omitirAreas() => state = state.copiar(areas: const []);

  /// Al pasar a A10: si las áreas cambiaron, marca las pruebas y el electivo
  /// que sugieren (RN-25). Sin áreas, el estudiante elige directamente
  /// (CU-05 4.a).
  void aplicarSugerencias(OpcionesPerfil opciones) {
    final areas = state.areas;
    final yaAplicadas = state.areasConSugerencias;
    if (yaAplicadas != null &&
        yaAplicadas.length == areas.length &&
        yaAplicadas.every(areas.contains)) {
      return;
    }
    if (areas.isEmpty) {
      state = state.copiar(areasConSugerencias: () => const []);
      return;
    }
    final elegidas = [for (final id in areas) ?opciones.area(id)];
    final pruebas = {for (final area in elegidas) ...area.pruebasSugeridas};
    final electivo = elegidas
        .map((area) => area.electivoSugeridoId)
        .nonNulls
        .firstOrNull;
    state = state.copiar(
      areasConSugerencias: () => [...areas],
      pruebas: pruebas,
      electivoId: () => electivo ?? state.electivoId,
      pruebaReforzarId: () => pruebas.contains(state.pruebaReforzarId)
          ? state.pruebaReforzarId
          : null,
    );
  }

  void alternarPrueba(int id) {
    final pruebas = {...state.pruebas};
    if (!pruebas.remove(id)) pruebas.add(id);
    state = state.copiar(
      pruebas: pruebas,
      pruebaReforzarId: () => pruebas.contains(state.pruebaReforzarId)
          ? state.pruebaReforzarId
          : null,
    );
  }

  void elegirElectivo(int id) => state = state.copiar(electivoId: () => id);

  void elegirReforzar(int? id) =>
      state = state.copiar(pruebaReforzarId: () => id);
}

final borradorPerfilProvider = NotifierProvider<EstadoBorrador, Borrador>(
  EstadoBorrador.new,
);
