import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:supera_paes/datos/fuentes/fuente_practica_remota.dart';
import 'package:supera_paes/datos/repositorios/repositorio_practica_api.dart';
import 'package:supera_paes/dominio/entidades/practica.dart';
import 'package:supera_paes/dominio/repositorios/repositorio_practica.dart';
import 'package:supera_paes/nucleo/errores.dart';
import 'package:supera_paes/presentacion/comunes/estado_cuenta.dart';
import 'package:supera_paes/presentacion/inicio/estado_inicio.dart';
import 'package:supera_paes/presentacion/perfil_estudio/estado_perfil.dart';

/// Práctica del estudiante (HU-30): sus rutas exigen sesión, así que van con
/// el cliente que agrega el token y lo renueva.
final repositorioPracticaProvider = Provider<RepositorioPractica>(
  (ref) => RepositorioPracticaApi(
    FuentePracticaRemota(ref.watch(clienteHttpConSesionProvider)),
  ),
);

/// Dificultades y lo que se puede practicar de cada prueba, con los
/// contenidos del curso del perfil (RN-24); `null` sin curso.
final opcionesPracticaProvider = FutureProvider<OpcionesPractica?>((ref) async {
  final curso = await ref.watch(
    perfilProvider.selectAsync((perfil) => perfil?.curso?.codigo),
  );
  if (curso == null) return null;
  return await ref.watch(repositorioPracticaProvider).opciones(curso);
});

/// Lo que el estudiante va eligiendo en A13 y A14.
class BorradorPractica {
  const BorradorPractica({
    this.pruebaId,
    this.alcance = Alcance.todaLaPrueba,
    this.dificultadId,
    this.cantidad = cantidadSugerida,
  });

  static const int cantidadMinima = 5;
  static const int cantidadMaxima = 20;
  static const int cantidadSugerida = 10;

  final int? pruebaId;
  final Alcance alcance;

  /// `null`: la mezcla equilibrada (HU-30 esc. 2).
  final int? dificultadId;
  final int cantidad;

  /// Lo que se manda al iniciar; `null` mientras no haya prueba.
  DatosPractica? get datos => switch (pruebaId) {
    final prueba? => DatosPractica(
      pruebaId: prueba,
      alcance: alcance,
      dificultadId: dificultadId,
      cantidad: cantidad,
    ),
    null => null,
  };
}

/// Borrador de la práctica; vuelve a empezar al cambiar de estudiante.
class EstadoBorradorPractica extends Notifier<BorradorPractica> {
  @override
  BorradorPractica build() {
    ref.watch(sesionProvider.select((sesion) => sesion.value?.estudiante.id));
    return const BorradorPractica();
  }

  /// Otra prueba: lo que se practicaba era de la anterior, así que vuelve a
  /// toda la prueba.
  void elegirPrueba(int id) => state = BorradorPractica(
    pruebaId: id,
    dificultadId: state.dificultadId,
    cantidad: state.cantidad,
  );

  void elegirAlcance(Alcance alcance) => state = BorradorPractica(
    pruebaId: state.pruebaId,
    alcance: alcance,
    dificultadId: state.dificultadId,
    cantidad: state.cantidad,
  );

  void elegirDificultad(int? id) => state = BorradorPractica(
    pruebaId: state.pruebaId,
    alcance: state.alcance,
    dificultadId: id,
    cantidad: state.cantidad,
  );

  /// Suma o resta preguntas, de 5 a 20 (HU-30 esc. 3).
  void cambiarCantidad(int diferencia) => state = BorradorPractica(
    pruebaId: state.pruebaId,
    alcance: state.alcance,
    dificultadId: state.dificultadId,
    cantidad: (state.cantidad + diferencia).clamp(
      BorradorPractica.cantidadMinima,
      BorradorPractica.cantidadMaxima,
    ),
  );

  /// Lo que se eligió en el aviso de A15.
  void usar(DatosPractica datos) => state = BorradorPractica(
    pruebaId: datos.pruebaId,
    alcance: datos.alcance,
    dificultadId: datos.dificultadId,
    cantidad: datos.cantidad,
  );
}

final borradorPracticaProvider =
    NotifierProvider<EstadoBorradorPractica, BorradorPractica>(
      EstadoBorradorPractica.new,
    );

/// La práctica en curso, el aviso de A15 o el resumen de A21: uno a la vez.
class Practica {
  const Practica({this.enCurso, this.sinPreguntas, this.resumen});

  final PracticaIniciada? enCurso;
  final SinPreguntas? sinPreguntas;
  final ResumenPractica? resumen;
}

/// Inicio y cierre de la práctica (CU-06 pasos 3 y 7).
class EstadoPractica extends Notifier<Practica> {
  RepositorioPractica get _repositorio => ref.read(repositorioPracticaProvider);

  @override
  Practica build() {
    ref.watch(sesionProvider.select((sesion) => sesion.value?.estudiante.id));
    return const Practica();
  }

  /// Inicia la práctica y devuelve si empezó. Sin preguntas suficientes
  /// guarda el aviso de A15 y devuelve `false`; los demás errores (como
  /// `CUPO_AGOTADO`) llegan al llamador como `ErrorApi`.
  Future<bool> iniciar(DatosPractica datos) async {
    try {
      state = Practica(enCurso: await _repositorio.iniciar(datos));
      return true;
    } on ErrorApi catch (error) {
      if (error.codigo != codigoSinPreguntas) rethrow;
      final opciones = switch (error.datos?['opciones']) {
        final List<dynamic> lista => lista.whereType<String>().toSet(),
        _ => const <String>{},
      };
      state = Practica(
        sinPreguntas: SinPreguntas(
          datos: datos,
          disponibles: switch (error.datos?['disponibles']) {
            final int disponibles => disponibles,
            _ => 0,
          },
          usarMezcla: opciones.contains('usar_mezcla'),
          ampliarAlcance: opciones.contains('ampliar_alcance'),
        ),
      );
      return false;
    }
  }

  /// Cierra la práctica en curso y deja su resumen (HU-30 esc. 5). El cupo
  /// de Inicio se vuelve a leer.
  Future<void> cerrar() async {
    final id = state.enCurso?.id;
    if (id == null) return;
    state = Practica(resumen: await _repositorio.cerrar(id));
    ref.invalidate(cupoDeHoyProvider);
  }

  static const String codigoSinPreguntas = 'SIN_PREGUNTAS_SUFICIENTES';
}

final practicaProvider = NotifierProvider<EstadoPractica, Practica>(
  EstadoPractica.new,
);
