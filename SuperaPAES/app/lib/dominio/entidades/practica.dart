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

/// Texto de lectura de una pregunta (Competencia Lectora, A20): su título,
/// el texto y, si tiene, una imagen (HU-34.2).
class TextoDeLectura {
  const TextoDeLectura({this.titulo, this.contenido, this.imagen});

  final String? titulo;
  final String? contenido;
  final String? imagen;
}

/// Una alternativa como la ve el estudiante: sin saber si es la correcta.
class AlternativaVisible {
  const AlternativaVisible({
    required this.id,
    required this.letra,
    required this.texto,
  });

  final int id;
  final String letra;
  final String texto;
}

/// La pregunta pendiente de la práctica (A17 y A20): sin la clave ni la
/// explicación (RN-06), que llegan al responder.
class PreguntaDePractica {
  const PreguntaDePractica({
    required this.itemId,
    required this.orden,
    required this.total,
    required this.enunciado,
    required this.alternativas,
    this.texto,
  });

  /// Id del ítem de la evaluación, con el que se responde.
  final int itemId;

  /// Número de la pregunta en la práctica (1 a [total]).
  final int orden;
  final int total;
  final String enunciado;
  final TextoDeLectura? texto;
  final List<AlternativaVisible> alternativas;

  bool get esLaUltima => orden >= total;
}

/// La respuesta corregida por el servidor (RN-06). El detalle de cada
/// alternativa y su explicación llegan con A19 (HU-32.2).
class Correccion {
  const Correccion({
    required this.esCorrecta,
    required this.alternativaElegidaId,
    required this.alternativaCorrectaId,
    this.explicacion,
  });

  final bool esCorrecta;
  final int alternativaElegidaId;
  final int alternativaCorrectaId;
  final String? explicacion;
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
