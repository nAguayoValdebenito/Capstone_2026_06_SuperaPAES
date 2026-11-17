/// Un eje con sus preguntas por repasar.
class EjePorRepasar {
  const EjePorRepasar({
    required this.id,
    required this.nombre,
    required this.preguntas,
  });

  final int id;
  final String nombre;
  final int preguntas;
}

/// Una prueba con sus preguntas por repasar, por eje.
class PruebaPorRepasar {
  const PruebaPorRepasar({
    required this.id,
    required this.codigo,
    required this.nombre,
    required this.preguntas,
    required this.ejes,
  });

  /// Un repaso trae hasta estas preguntas (DAS 4.2.5).
  static const int maximoPorRepaso = 10;

  final int id;

  /// «M1», para el filtro de A24.
  final String codigo;
  final String nombre;
  final int preguntas;
  final List<EjePorRepasar> ejes;

  /// Las que trae un repaso de toda la prueba.
  int get delRepaso =>
      preguntas > maximoPorRepaso ? maximoPorRepaso : preguntas;
}

/// Lo que el estudiante puede repasar (A24; HU-39, RF-A15, RN-04): las
/// preguntas cuya última respuesta fue incorrecta u omitida.
class PorRepasar {
  const PorRepasar({
    required this.total,
    required this.limite,
    required this.pruebas,
  });

  /// Todas las falladas, también las que quedan fuera del límite.
  final int total;

  /// Las más recientes que permite el plan; `null` con Todas las pruebas.
  final int? limite;

  /// Solo lo que entra en el límite.
  final List<PruebaPorRepasar> pruebas;

  /// Las que se pueden repasar ahora.
  int get repasables =>
      pruebas.fold(0, (suma, prueba) => suma + prueba.preguntas);
}
