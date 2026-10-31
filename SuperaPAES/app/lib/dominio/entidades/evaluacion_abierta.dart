import 'package:supera_paes/dominio/entidades/practica.dart';

/// La evaluación sin terminar del estudiante, para retomarla donde quedó
/// (HU-60, CU-28, RF-A22). RN-19 deja una sola.
class EvaluacionAbierta {
  const EvaluacionAbierta({
    required this.id,
    required this.tipo,
    required this.tipoNombre,
    required this.pruebaId,
    required this.prueba,
    required this.alcance,
    required this.dificultadId,
    required this.cantidad,
    required this.respondidas,
    this.segundosRestantes,
  });

  final int id;

  /// Código del tipo: `practica`, `mini_ensayo`...
  final String tipo;

  /// «Práctica», «Mini-ensayo»...
  final String tipoNombre;
  final int pruebaId;

  /// Como en Inicio: «Matemática M2».
  final String prueba;

  /// Lo que se eligió practicar; toda la prueba sin nombre, como al iniciar.
  final Alcance alcance;

  /// `null`: la mezcla.
  final int? dificultadId;
  final int cantidad;
  final int respondidas;

  /// Lo que le quedaba según el servidor al consultarla; `null` sin tiempo.
  final int? segundosRestantes;

  bool get conTiempo => segundosRestantes != null;
  bool get esPractica => tipo == 'practica';

  /// Para seguir la práctica en A17, con su encabezado.
  PracticaIniciada get practica =>
      PracticaIniciada(id: id, pruebaId: pruebaId, cantidad: cantidad);
  DatosPractica get datos => DatosPractica(
    pruebaId: pruebaId,
    alcance: alcance,
    dificultadId: dificultadId,
    cantidad: cantidad,
  );
}

/// La que el servidor cerró al consultarla: venció (RN-21) o era una
/// práctica sin actividad (RN-19). Se puede ver su resultado.
class EvaluacionRecienCerrada {
  const EvaluacionRecienCerrada({
    required this.id,
    required this.tipoNombre,
    required this.porTiempo,
  });

  final int id;
  final String tipoNombre;

  /// `false`: abandonada por inactividad.
  final bool porTiempo;
}

/// GET /evaluaciones/abierta: a lo más una de las dos.
class ConsultaEvaluacionAbierta {
  const ConsultaEvaluacionAbierta({this.abierta, this.cerrada});

  final EvaluacionAbierta? abierta;
  final EvaluacionRecienCerrada? cerrada;
}
