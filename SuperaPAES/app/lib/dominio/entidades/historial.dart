/// Una evaluación cerrada del estudiante (A34; HU-62, RF-A24, CU-30).
class EvaluacionDelHistorial {
  const EvaluacionDelHistorial({
    required this.id,
    required this.tipoNombre,
    required this.prueba,
    required this.cerradaEn,
    required this.cantidad,
    required this.correctas,
    this.alcance,
    this.codigoPrueba,
    this.abandonada = false,
    this.porcentaje,
    this.puntaje,
    this.recalculada = false,
  });

  final int id;

  /// «Práctica», «Mini-ensayo»...
  final String tipoNombre;

  /// Como en Inicio: «Matemática M1».
  final String prueba;
  final String? codigoPrueba;

  /// Lo que se eligió practicar; `null` si fue toda la prueba.
  final String? alcance;
  final DateTime cerradaEn;
  final int cantidad;
  final int correctas;

  /// Se cerró sin terminar y conserva lo respondido (RN-19).
  final bool abandonada;
  final double? porcentaje;

  /// Solo en el ensayo completo.
  final int? puntaje;

  /// Una pregunta se anuló y el resultado cambió (CU-30 2.b).
  final bool recalculada;
}

/// Una página del historial, de la más reciente a la más antigua.
class PaginaHistorial {
  const PaginaHistorial({
    required this.evaluaciones,
    required this.pagina,
    required this.porPagina,
    required this.total,
  });

  final List<EvaluacionDelHistorial> evaluaciones;
  final int pagina;
  final int porPagina;
  final int total;

  /// Al menos una, aunque esté vacía.
  int get paginas => total == 0 ? 1 : (total / porPagina).ceil();
}

/// Lo que se pide del historial (CU-30 paso 3).
class FiltrosHistorial {
  const FiltrosHistorial({
    this.pruebaId,
    this.tipo,
    this.grupo,
    this.pagina = 1,
  });

  /// `null`: todas las pruebas.
  final int? pruebaId;

  /// Código del tipo de evaluación; `null`: todos.
  final String? tipo;
  final String? grupo;
  final int pagina;

  bool get sinFiltros => pruebaId == null && tipo == null && grupo == null;
}
