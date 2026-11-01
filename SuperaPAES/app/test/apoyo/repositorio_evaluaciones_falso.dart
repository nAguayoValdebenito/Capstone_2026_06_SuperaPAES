import 'package:supera_paes/dominio/entidades/evaluacion_con_tiempo.dart';
import 'package:supera_paes/dominio/entidades/practica.dart';
import 'package:supera_paes/dominio/repositorios/repositorio_evaluaciones.dart';
import 'package:supera_paes/nucleo/errores.dart';

/// Una pregunta del mini-ensayo de prueba: `orden` 1 a 3, con las
/// alternativas A a D (ids `orden * 10 + 0..3`).
PreguntaConTiempo preguntaConTiempo(int orden, {int? elegidaId}) =>
    PreguntaConTiempo(
      itemId: 2000 + orden,
      orden: orden,
      enunciado: 'Pregunta $orden: ¿cuánto es $orden + $orden?',
      alternativas: [
        for (final (i, letra) in ['A', 'B', 'C', 'D'].indexed)
          AlternativaVisible(
            id: orden * 10 + i,
            letra: letra,
            texto: '${orden * 2 + i - 1}',
          ),
      ],
      elegidaId: elegidaId,
    );

/// Repositorio de las evaluaciones con tiempo sin red: el mini-ensayo del
/// boceto A25 (22 preguntas, 48 minutos, 4 ejes, 1 gratis), que al empezar
/// trae 3 preguntas para que las pruebas sean cortas.
class RepositorioEvaluacionesFalso implements RepositorioEvaluaciones {
  /// Lo que responde la disponibilidad del mini-ensayo.
  DisponibilidadMiniEnsayo mini = const DisponibilidadMiniEnsayo(
    pruebaId: 2,
    cantidad: 22,
    duracionMin: 48,
    ejes: 4,
    habilidades: 0,
    conPlan: false,
    gratisRestantes: 1,
    disponible: true,
  );

  /// Por defecto ya rendido, así empezar una práctica no ofrece A16.
  bool diagnosticoDisponible = false;

  /// Errores que responde iniciar, uno por intento, antes de empezar.
  final List<ErrorApi> erroresAlIniciar = [];

  /// Si no es `null`, guardar una respuesta responde este error.
  ErrorApi? errorAlGuardar;

  final List<int> consultadas = [];
  final List<int> iniciadas = [];
  final List<int> diagnosticosIniciados = [];

  /// Respuestas guardadas: (evaluación, ítem, alternativa).
  final List<(int, int, int)> guardadas = [];
  final List<int> entregadas = [];

  @override
  Future<DisponibilidadMiniEnsayo> disponibilidadMiniEnsayo(
    int pruebaId,
  ) async {
    consultadas.add(pruebaId);
    return DisponibilidadMiniEnsayo(
      pruebaId: pruebaId,
      cantidad: mini.cantidad,
      duracionMin: mini.duracionMin,
      ejes: mini.ejes,
      habilidades: mini.habilidades,
      conPlan: mini.conPlan,
      gratisRestantes: mini.gratisRestantes,
      disponible: mini.disponible,
    );
  }

  @override
  Future<DisponibilidadDiagnostico> disponibilidadDiagnostico(
    int pruebaId,
  ) async => DisponibilidadDiagnostico(
    pruebaId: pruebaId,
    cantidad: 15,
    duracionMin: 30,
    ejes: 3,
    habilidades: 0,
    anioEscolar: 2026,
    disponible: diagnosticoDisponible,
  );

  @override
  Future<EvaluacionConTiempo> iniciarMiniEnsayo(int pruebaId) async {
    iniciadas.add(pruebaId);
    return _iniciada(77, 'Mini-ensayo', pruebaId);
  }

  @override
  Future<EvaluacionConTiempo> iniciarDiagnostico(int pruebaId) async {
    diagnosticosIniciados.add(pruebaId);
    return _iniciada(78, 'Diagnóstico', pruebaId);
  }

  EvaluacionConTiempo _iniciada(int id, String tipoNombre, int pruebaId) {
    if (erroresAlIniciar.isNotEmpty) throw erroresAlIniciar.removeAt(0);
    return EvaluacionConTiempo(
      id: id,
      tipoNombre: tipoNombre,
      pruebaId: pruebaId,
      preguntas: [
        for (var orden = 1; orden <= 3; orden++) preguntaConTiempo(orden),
      ],
      segundosRestantes: mini.duracionMin * 60,
    );
  }

  @override
  Future<void> guardarRespuesta(
    int evaluacionId,
    int itemId,
    int alternativaId,
  ) async {
    if (errorAlGuardar case final error?) throw error;
    guardadas.add((evaluacionId, itemId, alternativaId));
  }

  @override
  Future<EntregaEvaluacion> entregar(int evaluacionId) async {
    entregadas.add(evaluacionId);
    return EntregaEvaluacion(id: evaluacionId, estado: 'entregada');
  }
}
