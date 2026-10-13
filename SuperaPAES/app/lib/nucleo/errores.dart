import 'package:dio/dio.dart';

/// Error de la API con el formato común
/// `{ "data": null, "error": { "codigo": "...", "mensaje": "..." },
/// "meta": null }`.
class ErrorApi implements Exception {
  const ErrorApi({
    required this.codigo,
    required this.mensaje,
    this.estadoHttp,
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

  /// Lee `error` de un cuerpo con el formato común; `null` si no trae error.
  static ErrorApi? desdeCuerpo(Object? cuerpo, {int? estadoHttp}) {
    if (cuerpo is! Map<String, dynamic>) return null;
    final error = cuerpo['error'];
    if (error is! Map<String, dynamic>) return null;
    final codigo = error['codigo'];
    final mensaje = error['mensaje'];
    if (codigo is! String || mensaje is! String) return null;
    return ErrorApi(codigo: codigo, mensaje: mensaje, estadoHttp: estadoHttp);
  }

  @override
  String toString() => 'ErrorApi($codigo): $mensaje';
}
