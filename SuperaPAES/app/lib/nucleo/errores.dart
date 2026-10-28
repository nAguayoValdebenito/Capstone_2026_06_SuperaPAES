import 'package:dio/dio.dart';

/// Problema de un campo en un error `VALIDACION`: `ruta` es el campo del
/// cuerpo y `motivo`, cuando viene, identifica la regla (por ejemplo
/// `contrasena_comun`, RN-31).
class ProblemaDeCampo {
  const ProblemaDeCampo({
    required this.ruta,
    required this.mensaje,
    this.motivo,
  });

  final String ruta;
  final String mensaje;
  final String? motivo;
}

/// Error de la API con el formato común
/// `{ "data": null, "error": { "codigo": "...", "mensaje": "...",
/// "detalles": [...] }, "meta": null }`.
class ErrorApi implements Exception {
  const ErrorApi({
    required this.codigo,
    required this.mensaje,
    this.estadoHttp,
    this.problemas = const [],
    this.datos,
  });

  /// Traduce un error de dio al formato común.
  factory ErrorApi.desdeDio(DioException excepcion) {
    final respuesta = excepcion.response;
    if (respuesta == null) {
      return const ErrorApi(
        codigo: 'SIN_CONEXION',
        mensaje: 'No se pudo conectar con la API. Revisa tu conexión.',
      );
    }
    return desdeCuerpo(respuesta.data, estadoHttp: respuesta.statusCode) ??
        ErrorApi(
          codigo: 'ERROR_DESCONOCIDO',
          mensaje: 'La API respondió ${respuesta.statusCode}.',
          estadoHttp: respuesta.statusCode,
        );
  }

  final String codigo;
  final String mensaje;
  final int? estadoHttp;

  /// Problemas por campo de un error `VALIDACION`; vacío en los demás.
  final List<ProblemaDeCampo> problemas;

  /// `detalles` cuando es un objeto y no una lista de problemas, como
  /// `{ disponibles, solicitadas, opciones }` de `SIN_PREGUNTAS_SUFICIENTES`.
  final Map<String, dynamic>? datos;

  /// Lee `error` de un cuerpo con el formato común; `null` si no trae error.
  static ErrorApi? desdeCuerpo(Object? cuerpo, {int? estadoHttp}) {
    if (cuerpo is! Map<String, dynamic>) return null;
    final error = cuerpo['error'];
    if (error is! Map<String, dynamic>) return null;
    final codigo = error['codigo'];
    final mensaje = error['mensaje'];
    if (codigo is! String || mensaje is! String) return null;
    return ErrorApi(
      codigo: codigo,
      mensaje: mensaje,
      estadoHttp: estadoHttp,
      problemas: _leerProblemas(error['detalles']),
      datos: switch (error['detalles']) {
        final Map<String, dynamic> datos => datos,
        _ => null,
      },
    );
  }

  /// `detalles` es una lista de problemas solo en `VALIDACION`; en otros
  /// errores puede ser otra cosa (por ejemplo `{ intentosRestantes }`).
  static List<ProblemaDeCampo> _leerProblemas(Object? detalles) {
    if (detalles is! List<dynamic>) return const [];
    return [
      for (final problema in detalles.whereType<Map<String, dynamic>>())
        if (problema case {
          'ruta': final String ruta,
          'mensaje': final String mensaje,
        })
          ProblemaDeCampo(
            ruta: ruta,
            mensaje: mensaje,
            motivo: switch (problema['motivo']) {
              final String motivo => motivo,
              _ => null,
            },
          ),
    ];
  }

  /// Mensaje del primer problema del campo `ruta`, o `null` si no tiene.
  String? mensajeDeCampo(String ruta) {
    for (final problema in problemas) {
      if (problema.ruta == ruta) return problema.mensaje;
    }
    return null;
  }

  @override
  String toString() => 'ErrorApi($codigo): $mensaje';
}
