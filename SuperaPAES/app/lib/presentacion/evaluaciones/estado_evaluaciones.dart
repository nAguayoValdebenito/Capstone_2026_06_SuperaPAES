import 'package:clock/clock.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show FutureProviderFamily;

import 'package:supera_paes/datos/fuentes/fuente_evaluaciones_remota.dart';
import 'package:supera_paes/datos/repositorios/repositorio_evaluaciones_api.dart';
import 'package:supera_paes/dominio/entidades/evaluacion_con_tiempo.dart';
import 'package:supera_paes/dominio/entidades/practica.dart';
import 'package:supera_paes/dominio/repositorios/repositorio_evaluaciones.dart';
import 'package:supera_paes/presentacion/comunes/estado_cuenta.dart';
import 'package:supera_paes/presentacion/practicar/estado_practica.dart';
import 'package:supera_paes/presentacion/progreso/estado_progreso.dart';

/// Evaluaciones con tiempo (HU-36, HU-40): sus rutas exigen sesión, así que
/// van con el cliente que agrega el token y lo renueva.
final repositorioEvaluacionesProvider = Provider<RepositorioEvaluaciones>(
  (ref) => RepositorioEvaluacionesApi(
    FuenteEvaluacionesRemota(ref.watch(clienteHttpConSesionProvider)),
  ),
);

/// La prueba elegida en A25; `null` mientras no se elija otra que la del
/// perfil.
class PruebaDeEvaluaciones extends Notifier<int?> {
  @override
  int? build() {
    ref.watch(sesionProvider.select((sesion) => sesion.value?.estudiante.id));
    return null;
  }

  int? get prueba => state;
  set prueba(int? id) => state = id;
}

final pruebaDeEvaluacionesProvider =
    NotifierProvider<PruebaDeEvaluaciones, int?>(PruebaDeEvaluaciones.new);

/// Preguntas, minutos y uso gratis del mes del mini-ensayo de una prueba.
/// Se vuelve a leer al cambiar de estudiante, al empezar o entregar una
/// evaluación y al deslizar en A25.
final FutureProviderFamily<DisponibilidadMiniEnsayo, int>
disponibilidadMiniProvider =
    FutureProvider.family<DisponibilidadMiniEnsayo, int>((ref, pruebaId) {
      ref.watch(sesionProvider.select((sesion) => sesion.value?.estudiante.id));
      return ref
          .watch(repositorioEvaluacionesProvider)
          .disponibilidadMiniEnsayo(pruebaId);
    });

/// Si el diagnóstico de una prueba se puede rendir este año escolar, con
/// sus cifras (A12, A16 y A25). Se relee como [disponibilidadMiniProvider].
final FutureProviderFamily<DisponibilidadDiagnostico, int>
disponibilidadDiagnosticoProvider =
    FutureProvider.family<DisponibilidadDiagnostico, int>((ref, pruebaId) {
      ref.watch(sesionProvider.select((sesion) => sesion.value?.estudiante.id));
      return ref
          .watch(repositorioEvaluacionesProvider)
          .disponibilidadDiagnostico(pruebaId);
    });

/// El ensayo completo de una prueba: si lo cubre el plan y sus cifras.
/// Se relee como [disponibilidadMiniProvider].
final FutureProviderFamily<DisponibilidadEnsayo, int>
disponibilidadEnsayoProvider = FutureProvider.family<DisponibilidadEnsayo, int>(
  (ref, pruebaId) {
    ref.watch(sesionProvider.select((sesion) => sesion.value?.estudiante.id));
    return ref
        .watch(repositorioEvaluacionesProvider)
        .disponibilidadEnsayo(pruebaId);
  },
);

/// La evaluación con tiempo que se está respondiendo (A27 y A28): sus
/// preguntas con lo elegido, la que se ve y la hora de término en el reloj
/// del teléfono, calculada con lo que quedaba según el servidor (RN-21).
class EvaluacionEnCurso {
  const EvaluacionEnCurso({
    required this.evaluacion,
    required this.preguntas,
    required this.actual,
    required this.venceEn,
  });

  final EvaluacionConTiempo evaluacion;
  final List<PreguntaConTiempo> preguntas;

  /// Índice de la pregunta que se ve.
  final int actual;
  final DateTime venceEn;

  PreguntaConTiempo get pregunta => preguntas[actual];
  int get respondidas => preguntas.where((p) => p.respondida).length;
  int get sinResponder => preguntas.length - respondidas;

  /// Segundos que quedan, redondeados hacia arriba: «48:00» al empezar.
  int get segundosRestantes {
    final quedan = venceEn.difference(clock.now()).inMilliseconds;
    return quedan <= 0 ? 0 : (quedan / 1000).ceil();
  }

  EvaluacionEnCurso copiar({List<PreguntaConTiempo>? preguntas, int? actual}) =>
      EvaluacionEnCurso(
        evaluacion: evaluacion,
        preguntas: preguntas ?? this.preguntas,
        actual: actual ?? this.actual,
        venceEn: venceEn,
      );
}

/// Empieza, retoma, responde y entrega la evaluación con tiempo (CU-10).
/// Vuelve a empezar al cambiar de estudiante.
class EstadoEvaluacionConTiempo extends Notifier<EvaluacionEnCurso?> {
  @override
  EvaluacionEnCurso? build() {
    ref.watch(sesionProvider.select((sesion) => sesion.value?.estudiante.id));
    return null;
  }

  RepositorioEvaluaciones get _repositorio =>
      ref.read(repositorioEvaluacionesProvider);

  /// Arma el mini-ensayo y fija su hora de término (CU-10 pasos 3 y 4). Los
  /// rechazos llegan como `ErrorApi`.
  Future<void> empezarMiniEnsayo(int pruebaId) =>
      _empezar(_repositorio.iniciarMiniEnsayo(pruebaId));

  /// Arma el ensayo completo (CU-10c); los rechazos llegan como `ErrorApi`.
  Future<void> empezarEnsayo(int pruebaId) =>
      _empezar(_repositorio.iniciarEnsayo(pruebaId));

  /// Arma el diagnóstico (CU-10a); los rechazos llegan como `ErrorApi`.
  Future<void> empezarDiagnostico(int pruebaId) =>
      _empezar(_repositorio.iniciarDiagnostico(pruebaId));

  Future<void> _empezar(Future<EvaluacionConTiempo> inicio) async {
    final evaluacion = await inicio;
    // Una práctica abierta se cerró como abandonada (RN-19).
    ref.invalidate(evaluacionAbiertaProvider);
    _releerDisponibilidad(evaluacion.pruebaId);
    retomar(evaluacion);
  }

  void _releerDisponibilidad(int pruebaId) => ref
    ..invalidate(disponibilidadMiniProvider(pruebaId))
    ..invalidate(disponibilidadDiagnosticoProvider(pruebaId))
    ..invalidate(disponibilidadEnsayoProvider(pruebaId));

  /// Sigue la evaluación donde quedó (CU-28): en la primera sin responder,
  /// con el reloj que siguió corriendo.
  void retomar(EvaluacionConTiempo evaluacion) {
    final pendiente = evaluacion.preguntas.indexWhere((p) => !p.respondida);
    state = EvaluacionEnCurso(
      evaluacion: evaluacion,
      preguntas: evaluacion.preguntas,
      actual: pendiente < 0 ? 0 : pendiente,
      venceEn: clock.now().add(Duration(seconds: evaluacion.segundosRestantes)),
    );
  }

  void irA(int indice) {
    final enCurso = state;
    if (enCurso == null) return;
    state = enCurso.copiar(
      actual: indice.clamp(0, enCurso.preguntas.length - 1),
    );
  }

  /// Guarda o cambia la respuesta, sin corregirla (CU-10 paso 6). Solo
  /// queda elegida cuando el servidor la guardó.
  Future<void> responder(int itemId, int alternativaId) async {
    final enCurso = state;
    if (enCurso == null) return;
    await _repositorio.guardarRespuesta(
      enCurso.evaluacion.id,
      itemId,
      alternativaId,
    );
    final actual = state;
    if (actual == null || actual.evaluacion.id != enCurso.evaluacion.id) {
      return;
    }
    state = actual.copiar(
      preguntas: [
        for (final p in actual.preguntas)
          if (p.itemId == itemId) p.conElegida(alternativaId) else p,
      ],
    );
  }

  Future<int>? _entrega;

  /// Cierra y corrige la evaluación (CU-10 paso 8); devuelve su id para ver
  /// el resultado. Si ya se está entregando (el reloj llegó a cero mientras
  /// se tocaba «Entregar ahora»), espera esa misma entrega.
  Future<int> entregar() =>
      _entrega ??= _entregar().whenComplete(() => _entrega = null);

  Future<int> _entregar() async {
    final enCurso = state;
    if (enCurso == null) throw StateError('No hay una evaluación en curso.');
    final entrega = await _repositorio.entregar(enCurso.evaluacion.id);
    terminar();
    return entrega.id;
  }

  /// Se entregó o se acabó el tiempo: el progreso suma el resultado y, tras
  /// el diagnóstico, sus ejes a reforzar (RN-14).
  void terminar() {
    final pruebaId = state?.evaluacion.pruebaId;
    state = null;
    ref
      ..invalidate(evaluacionAbiertaProvider)
      ..invalidate(progresoProvider);
    if (pruebaId != null) _releerDisponibilidad(pruebaId);
  }
}

final evaluacionConTiempoProvider =
    NotifierProvider<EstadoEvaluacionConTiempo, EvaluacionEnCurso?>(
      EstadoEvaluacionConTiempo.new,
    );

/// El diagnóstico que ofrece A16: de qué prueba, con sus cifras y, si se
/// ofreció al empezar una práctica (CU-06 alternativo 2.a), esa práctica
/// para «Ahora no, practicar igual».
typedef OfertaDiagnostico = ({
  DisponibilidadDiagnostico diagnostico,
  DatosPractica? practica,
});

class EstadoOfertaDiagnostico extends Notifier<OfertaDiagnostico?> {
  @override
  OfertaDiagnostico? build() {
    ref.watch(sesionProvider.select((sesion) => sesion.value?.estudiante.id));
    return null;
  }

  void ofrecer(
    DisponibilidadDiagnostico diagnostico, {
    DatosPractica? practica,
  }) => state = (diagnostico: diagnostico, practica: practica);
}

final ofertaDiagnosticoProvider =
    NotifierProvider<EstadoOfertaDiagnostico, OfertaDiagnostico?>(
      EstadoOfertaDiagnostico.new,
    );

/// Las pruebas cuyo diagnóstico se dejó para después con «Ahora no»: no se
/// vuelve a ofrecer al practicarlas hasta que se abra de nuevo la app.
class DiagnosticosPospuestos extends Notifier<Set<int>> {
  @override
  Set<int> build() {
    ref.watch(sesionProvider.select((sesion) => sesion.value?.estudiante.id));
    return const {};
  }

  void posponer(int pruebaId) => state = {...state, pruebaId};
}

final diagnosticosPospuestosProvider =
    NotifierProvider<DiagnosticosPospuestos, Set<int>>(
      DiagnosticosPospuestos.new,
    );
