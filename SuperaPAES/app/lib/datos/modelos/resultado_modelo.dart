import 'package:supera_paes/dominio/entidades/perfil_estudiante.dart';
import 'package:supera_paes/dominio/entidades/practica.dart';
import 'package:supera_paes/dominio/entidades/resultado_evaluacion.dart';
import 'package:supera_paes/nucleo/ids.dart';

/// Lee el JSON de /api/v1/app/evaluaciones/:id/resultado y /revision
/// (docs/contratos/HU-61.md).
abstract final class ResultadoModelo {
  static ResultadoEvaluacion resultado(Map<String, dynamic> json) {
    final tipo = json['tipo'] as Map<String, dynamic>;
    final prueba = json['prueba'] as Map<String, dynamic>;
    final estado = json['estado'] as Map<String, dynamic>;
    final tabla = json['tablaConversion'] as Map<String, dynamic>?;
    return ResultadoEvaluacion(
      id: leerId(json['id']),
      tipo: tipo['codigo'] as String,
      tipoNombre: tipo['nombre'] as String,
      prueba: nombreDePrueba(
        prueba['codigo'] as String,
        prueba['nombre'] as String,
      ),
      estado: estado['codigo'] as String,
      cantidad: json['cantidad'] as int,
      puntuables: json['puntuables'] as int,
      correctas: json['correctas'] as int,
      incorrectas: json['incorrectas'] as int,
      omitidas: json['omitidas'] as int,
      porcentaje: (json['porcentaje'] as num).toDouble(),
      tiempoUsadoSeg: json['tiempoUsadoSeg'] as int,
      duracionMin: json['duracionMin'] as int?,
      puntaje: json['puntaje'] as int?,
      tablaConversion: tabla == null
          ? null
          : TablaConversion(
              anioAdmision: tabla['anioAdmision'] as int,
              proceso: tabla['proceso'] as String,
            ),
      recalculado: json['recalculadoEn'] != null,
      ejes: _grupos(json['ejes']),
      habilidades: _grupos(json['habilidades']),
    );
  }

  static List<GrupoDeResultado> _grupos(Object? lista) => [
    for (final valor in lista as List<Object?>? ?? const [])
      if (valor case final Map<String, dynamic> grupo)
        GrupoDeResultado(
          nombre: grupo['nombre'] as String,
          preguntas: grupo['preguntas'] as int,
          correctas: grupo['correctas'] as int,
        ),
  ];

  static List<PreguntaRevisada> revision(Map<String, dynamic> json) => [
    for (final valor in json['preguntas'] as List<Object?>)
      if (valor case final Map<String, dynamic> pregunta) _pregunta(pregunta),
  ];

  static PreguntaRevisada _pregunta(Map<String, dynamic> json) {
    final texto = json['texto'] as Map<String, dynamic>?;
    final elegida = json['alternativaElegidaId'];
    return PreguntaRevisada(
      orden: json['orden'] as int,
      eje: (json['eje'] as Map<String, dynamic>)['nombre'] as String,
      resultado: ResultadoPregunta.values.byName(json['resultado'] as String),
      puntuable: json['puntuable'] != false,
      anulada: json['anulada'] == true,
      texto: texto == null
          ? null
          : TextoDeLectura(
              titulo: texto['titulo'] as String?,
              contenido: texto['contenido'] as String?,
              imagen: texto['imagenUrl'] as String?,
            ),
      enunciado: json['enunciado'] as String,
      explicacion: json['explicacion'] as String,
      alternativaElegidaId: elegida == null ? null : leerId(elegida),
      alternativaCorrectaId: leerId(json['alternativaCorrectaId']),
      alternativas: [
        for (final valor in json['alternativas'] as List<Object?>)
          if (valor case final Map<String, dynamic> alternativa)
            AlternativaCorregida(
              id: leerId(alternativa['id']),
              letra: alternativa['letra'] as String,
              texto: alternativa['texto'] as String,
              explicacion: alternativa['explicacion'] as String?,
            ),
      ],
    );
  }
}
