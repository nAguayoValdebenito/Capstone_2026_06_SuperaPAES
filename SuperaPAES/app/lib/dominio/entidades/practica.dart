import 'package:supera_paes/dominio/entidades/perfil_estudiante.dart';

/// Dificultad que se puede elegir, con su parte en la mezcla equilibrada
/// (RN-09).
class Dificultad {
  const Dificultad({
    required this.id,
    required this.codigo,
    required this.nombre,
    required this.mezcla,
  });

  final int id;
  final String codigo;
  final String nombre;

  /// Porcentaje de esta dificultad en la mezcla equilibrada (30, 45 y 25).
  final int mezcla;
}

/// Eje con los contenidos que el estudiante ya vio según su curso (RN-24).
class EjePractica {
  const EjePractica({
    required this.id,
    required this.nombre,
    required this.contenidos,
  });

  final int id;
  final String nombre;
  final List<OpcionConNombre> contenidos;
}

/// Lo que se puede practicar de una prueba (A13 y A14).
class PruebaPractica {
  const PruebaPractica({
    required this.id,
    required this.codigo,
    required this.ejes,
    required this.habilidades,
  });

  final int id;
  final String codigo;
  final List<EjePractica> ejes;
  final List<OpcionConNombre> habilidades;
}

/// Dificultades y pruebas para personalizar la práctica (HU-30, RF-A06).
class OpcionesPractica {
  const OpcionesPractica({required this.dificultades, required this.pruebas});

  final List<Dificultad> dificultades;
  final List<PruebaPractica> pruebas;

  PruebaPractica? prueba(int id) {
    for (final prueba in pruebas) {
      if (prueba.id == id) return prueba;
    }
    return null;
  }
}

/// Qué practicar dentro de la prueba (HU-30 esc. 1).
enum TipoAlcance { prueba, eje, contenido, habilidad }

/// Toda la prueba, o un eje, contenido o habilidad de ella con su nombre.
class Alcance {
  const Alcance(this.tipo, {this.id, this.nombre});

  /// Toda la prueba.
  static const Alcance todaLaPrueba = Alcance(TipoAlcance.prueba);

  final TipoAlcance tipo;
  final int? id;
  final String? nombre;
}

/// Lo que se manda para iniciar una práctica: sin dificultad, la mezcla
/// equilibrada (HU-30 esc. 2); la cantidad va de 5 a 20 (esc. 3).
class DatosPractica {
  const DatosPractica({
    required this.pruebaId,
    required this.alcance,
    required this.dificultadId,
    required this.cantidad,
  });

  final int pruebaId;
  final Alcance alcance;
  final int? dificultadId;
  final int cantidad;
}

/// Práctica recién iniciada (POST /evaluaciones/practicas).
class PracticaIniciada {
  const PracticaIniciada({
    required this.id,
    required this.pruebaId,
    required this.cantidad,
  });

  final int id;
  final int pruebaId;
  final int cantidad;
}

/// Lo que respondió la API cuando no hay preguntas para lo elegido (HU-30
/// esc. 4): cuántas hay, cuántas se pidieron y qué se puede cambiar.
class SinPreguntas {
  const SinPreguntas({
    required this.datos,
    required this.disponibles,
    required this.usarMezcla,
    required this.ampliarAlcance,
  });

  /// Lo que se intentó iniciar.
  final DatosPractica datos;
  final int disponibles;

  /// Con la mezcla de dificultad sí alcanzan.
  final bool usarMezcla;

  /// Con toda la prueba sí alcanzan.
  final bool ampliarAlcance;
}

/// Resumen de una práctica cerrada (HU-30 esc. 5, A21).
class ResumenPractica {
  const ResumenPractica({
    required this.id,
    required this.prueba,
    required this.alcance,
    required this.dificultad,
    required this.cantidad,
    required this.correctas,
    required this.incorrectas,
    required this.omitidas,
    required this.porcentaje,
    required this.tiempoUsadoSeg,
  });

  final int id;

  /// Nombre de la prueba como en Inicio («Matemática M2», ver
  /// [nombreDePrueba]).
  final String prueba;

  /// Toda la prueba, o el eje, contenido o habilidad practicado.
  final Alcance alcance;

  /// «Mezcla», «Fácil», «Media» o «Difícil».
  final String dificultad;
  final int cantidad;
  final int correctas;
  final int incorrectas;

  /// Preguntas sin responder al cerrar.
  final int omitidas;
  final double porcentaje;
  final int tiempoUsadoSeg;
}
