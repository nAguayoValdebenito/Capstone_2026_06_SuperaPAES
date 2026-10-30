import 'package:supera_paes/dominio/entidades/practica.dart';

/// Preguntas y correctas de un eje o una habilidad en el resultado.
class GrupoDeResultado {
  const GrupoDeResultado({
    required this.nombre,
    required this.preguntas,
    required this.correctas,
  });

  final String nombre;
  final int preguntas;
  final int correctas;

  double get porcentaje => preguntas == 0 ? 0 : 100 * correctas / preguntas;
}

/// Tabla de conversión del DEMRE con que se estimó el puntaje (RN-23).
class TablaConversion {
  const TablaConversion({required this.anioAdmision, required this.proceso});

  final int anioAdmision;

  /// «Regular» o «Invierno».
  final String proceso;
}

/// Resultado guardado de una evaluación cerrada (HU-61, RF-A23; A30, A32 y
/// A32b): lo calculó el servidor al cerrarla.
class ResultadoEvaluacion {
  const ResultadoEvaluacion({
    required this.id,
    required this.tipo,
    required this.tipoNombre,
    required this.prueba,
    required this.estado,
    required this.cantidad,
    required this.puntuables,
    required this.correctas,
    required this.incorrectas,
    required this.omitidas,
    required this.porcentaje,
    required this.tiempoUsadoSeg,
    required this.ejes,
    required this.habilidades,
    this.duracionMin,
    this.puntaje,
    this.tablaConversion,
    this.recalculado = false,
  });

  final int id;

  /// `practica`, `repaso`, `diagnostico`, `mini_ensayo` o `ensayo`.
  final String tipo;

  /// «Mini-ensayo», «Ensayo completo»...
  final String tipoNombre;

  /// Nombre de la prueba como en Inicio («Matemática M1»).
  final String prueba;

  /// `entregada`, `tiempo_agotado` o `abandonada`.
  final String estado;
  final int cantidad;

  /// Las que cuentan: sin las que no puntúan ni las anuladas (RN-22).
  final int puntuables;
  final int correctas;
  final int incorrectas;
  final int omitidas;
  final double porcentaje;
  final int tiempoUsadoSeg;

  /// Tiempo de la evaluación; `null` en la práctica y el repaso.
  final int? duracionMin;

  /// Puntaje estimado de 100 a 1.000; solo en el ensayo completo con tabla.
  final int? puntaje;
  final TablaConversion? tablaConversion;

  /// Se recalculó por la anulación de una pregunta.
  final bool recalculado;
  final List<GrupoDeResultado> ejes;
  final List<GrupoDeResultado> habilidades;

  bool get esEnsayo => tipo == 'ensayo';
}

/// Cómo quedó una pregunta en la revisión.
enum ResultadoPregunta { correcta, incorrecta, omitida }

/// Una pregunta de la revisión, tal como la vio el estudiante aunque después
/// se haya editado (HU-61 esc. 2, A33).
class PreguntaRevisada {
  const PreguntaRevisada({
    required this.orden,
    required this.eje,
    required this.resultado,
    required this.enunciado,
    required this.explicacion,
    required this.alternativaCorrectaId,
    required this.alternativas,
    this.alternativaElegidaId,
    this.texto,
    this.puntuable = true,
    this.anulada = false,
  });

  final int orden;

  /// Nombre del eje de la pregunta.
  final String eje;
  final ResultadoPregunta resultado;
  final TextoDeLectura? texto;
  final String enunciado;
  final String explicacion;

  /// `null` si quedó sin responder.
  final int? alternativaElegidaId;
  final int alternativaCorrectaId;
  final List<AlternativaCorregida> alternativas;

  /// No puntúa (preguntas de prueba del ensayo completo, como en la PAES).
  final bool puntuable;

  /// Se anuló por un error y no cuenta.
  final bool anulada;

  AlternativaCorregida? get elegida => [
    for (final a in alternativas)
      if (a.id == alternativaElegidaId) a,
  ].firstOrNull;
}
