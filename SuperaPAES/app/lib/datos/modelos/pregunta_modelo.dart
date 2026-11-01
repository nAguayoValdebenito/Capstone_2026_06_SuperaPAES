import 'package:supera_paes/dominio/entidades/practica.dart';
import 'package:supera_paes/nucleo/ids.dart';

/// Lo que comparten las preguntas de la práctica y las de las evaluaciones
/// con tiempo: el texto de lectura y las alternativas sin la correcta.
abstract final class PreguntaModelo {
  /// El texto de lectura de una pregunta (A20); `null` si no tiene.
  static TextoDeLectura? textoDeLectura(Object? valor) {
    final texto = valor as Map<String, dynamic>?;
    return texto == null
        ? null
        : TextoDeLectura(
            titulo: texto['titulo'] as String?,
            contenido: texto['contenido'] as String?,
            imagen: texto['imagen'] as String?,
          );
  }

  /// Las alternativas como llegan, sin saber cuál es la correcta (RN-06).
  static List<AlternativaVisible> alternativas(Object? lista) => [
    for (final valor in lista! as List<Object?>)
      _alternativa(valor! as Map<String, dynamic>),
  ];

  static AlternativaVisible _alternativa(Map<String, dynamic> json) =>
      AlternativaVisible(
        id: leerId(json['id']),
        letra: json['letra'] as String,
        texto: json['texto'] as String,
      );
}
