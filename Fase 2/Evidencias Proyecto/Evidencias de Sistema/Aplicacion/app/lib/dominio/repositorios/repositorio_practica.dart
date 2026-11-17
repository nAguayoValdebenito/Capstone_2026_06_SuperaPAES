import 'package:supera_paes/dominio/entidades/evaluacion_abierta.dart';
import 'package:supera_paes/dominio/entidades/por_repasar.dart';
import 'package:supera_paes/dominio/entidades/practica.dart';

/// Contrato de la práctica del estudiante de la sesión (HU-30, CU-06). Las
/// rutas exigen la sesión de la app; los errores llegan como `ErrorApi`.
abstract interface class RepositorioPractica {
  /// Dificultades y pruebas con sus ejes, los contenidos que se enseñan hasta
  /// `curso` (código como `3M`) y sus habilidades (A13 y A14).
  Future<OpcionesPractica> opciones(String curso);

  /// Inicia la práctica. Sin preguntas suficientes llega `ErrorApi`
  /// `SIN_PREGUNTAS_SUFICIENTES`; sin cupo, `CUPO_AGOTADO`.
  Future<PracticaIniciada> iniciar(DatosPractica datos);

  /// Las preguntas por repasar, por prueba y eje, con el límite del plan
  /// (A24).
  Future<PorRepasar> porRepasar();

  /// Inicia un repaso de la prueba o de uno de sus ejes. Sigue como una
  /// práctica: [siguiente], [responder] y [cerrar]. Sin falladas en ese
  /// alcance llega `SIN_PREGUNTAS_SUFICIENTES`.
  Future<PracticaIniciada> iniciarRepaso(int pruebaId, {int? ejeId});

  /// La pregunta pendiente de la práctica: la que no se respondió todavía o,
  /// si no hay, una nueva (A17). Sin cupo llega `CUPO_AGOTADO`; con todas
  /// respondidas, `PRACTICA_COMPLETA`.
  Future<PreguntaDePractica> siguiente(int practicaId);

  /// Responde la pregunta; la corrige el servidor (RN-06). En la práctica la
  /// respuesta es definitiva.
  Future<Correccion> responder(int practicaId, int itemId, int alternativaId);

  /// Cierra la práctica y devuelve su resumen (A21).
  Future<ResumenPractica> cerrar(int id);

  /// La evaluación sin terminar, para retomarla (HU-60, A12 y A29). Si
  /// venció o era una práctica sin actividad, el servidor la cierra y la
  /// informa como cerrada.
  Future<ConsultaEvaluacionAbierta> evaluacionAbierta();
}
