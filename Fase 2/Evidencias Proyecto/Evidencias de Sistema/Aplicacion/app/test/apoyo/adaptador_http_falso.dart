import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';

/// Adaptador HTTP de dio para las pruebas: responde según una función y
/// guarda las peticiones recibidas, sin red.
class AdaptadorHttpFalso implements HttpClientAdapter {
  AdaptadorHttpFalso(this.responder);

  final (int, Map<String, dynamic>) Function(RequestOptions opciones) responder;
  final List<RequestOptions> peticiones = [];

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    peticiones.add(options);
    final (estado, cuerpo) = responder(options);
    return ResponseBody.fromString(
      jsonEncode(cuerpo),
      estado,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}

/// Respuesta con el formato común y `data`.
(int, Map<String, dynamic>) respuestaOk(Object? data, {int estado = 200}) =>
    (estado, {'data': data, 'error': null, 'meta': null});

/// Respuesta de error con el formato común.
(int, Map<String, dynamic>) respuestaError(
  int estado,
  String codigo,
  String mensaje, {
  Object? detalles,
}) => (
  estado,
  {
    'data': null,
    'error': {'codigo': codigo, 'mensaje': mensaje, 'detalles': ?detalles},
    'meta': null,
  },
);
