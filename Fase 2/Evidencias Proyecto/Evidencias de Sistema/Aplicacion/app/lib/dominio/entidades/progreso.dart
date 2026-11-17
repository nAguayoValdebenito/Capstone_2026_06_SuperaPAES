/// Progreso del estudiante (HU-38, RF-A10): por prueba, eje y habilidad,
/// sumando prácticas, repasos y evaluaciones. Es el mismo con cualquier plan.
class ProgresoEstudiante {
  const ProgresoEstudiante({required this.pruebas});

  /// Solo las pruebas con respuestas.
  final List<ProgresoPrueba> pruebas;

  ProgresoPrueba? prueba(int id) {
    for (final prueba in pruebas) {
      if (prueba.pruebaId == id) return prueba;
    }
    return null;
  }
}

class ProgresoPrueba {
  const ProgresoPrueba({
    required this.pruebaId,
    required this.codigo,
    required this.respondidas,
    required this.acierto,
    required this.aciertoPorDificultad,
    required this.ejes,
    required this.habilidades,
    required this.semanas,
    required this.ensayos,
  });

  final int pruebaId;
  final String codigo;
  final int respondidas;

  /// Porcentaje de respuestas correctas.
  final double acierto;

  /// Porcentaje por código de dificultad (facil, media, dificil); solo las
  /// que tienen respuestas.
  final Map<String, double> aciertoPorDificultad;
  final List<GrupoProgreso> ejes;
  final List<GrupoProgreso> habilidades;
  final List<SemanaProgreso> semanas;
  final List<EnsayoProgreso> ensayos;

  /// En Competencia Lectora se refuerza por habilidad; en las demás, por eje
  /// (RN-14).
  bool get porHabilidad => codigo == 'CL';

  List<GrupoProgreso> get grupos => porHabilidad ? habilidades : ejes;
}

/// Un eje o una habilidad, con su acierto ponderado (las difíciles pesan
/// más) y si se debe reforzar (RN-14).
class GrupoProgreso {
  const GrupoProgreso({
    required this.id,
    required this.nombre,
    required this.respondidas,
    required this.aciertoPonderado,
    required this.aReforzar,
  });

  final int id;
  final String nombre;
  final int respondidas;
  final double aciertoPonderado;
  final bool aReforzar;
}

class SemanaProgreso {
  const SemanaProgreso({
    required this.lunes,
    required this.respondidas,
    required this.acierto,
  });

  /// Lunes de la semana, en hora de Chile.
  final DateTime lunes;
  final int respondidas;
  final double acierto;
}

/// Ensayo completo con su puntaje estimado (RN-23).
class EnsayoProgreso {
  const EnsayoProgreso({
    required this.id,
    required this.cerradaEn,
    required this.puntaje,
  });

  final int id;
  final DateTime cerradaEn;
  final int puntaje;
}
