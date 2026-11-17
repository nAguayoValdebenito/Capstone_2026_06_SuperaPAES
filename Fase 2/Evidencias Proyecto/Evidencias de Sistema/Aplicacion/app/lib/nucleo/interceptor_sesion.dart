import 'package:dio/dio.dart';

/// Agrega el token de acceso a cada petición y, si la API responde 401,
/// renueva la sesión una sola vez y repite la petición (RNF-01: JWT de 15
/// minutos que se renueva de forma segura).
///
/// Es un [QueuedInterceptor]: los errores se atienden de a uno, así que si
/// varias peticiones vencen a la vez se renueva una sola vez y las demás se
/// repiten con el token nuevo.
class InterceptorSesion extends QueuedInterceptor {
  InterceptorSesion({
    required this.tokenAcceso,
    required this.renovar,
    required this.reintentar,
  });

  /// Token de acceso de la sesión abierta, o `null` si no hay sesión.
  final String? Function() tokenAcceso;

  /// Renueva la sesión; `true` si hay un token de acceso nuevo. Si la API la
  /// rechaza, quien la implementa cierra la sesión local.
  final Future<bool> Function() renovar;

  /// Repite una petición con un cliente sin este interceptor.
  final Future<Response<Object?>> Function(RequestOptions opciones) reintentar;

  static const String _encabezado = 'Authorization';
  static const String _reintentada = 'sesion_reintentada';

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    final token = tokenAcceso();
    if (token != null) options.headers[_encabezado] = 'Bearer $token';
    handler.next(options);
  }

  @override
  Future<void> onError(
    DioException err,
    ErrorInterceptorHandler handler,
  ) async {
    final opciones = err.requestOptions;
    final usado = opciones.headers[_encabezado];
    final esReintento = opciones.extra[_reintentada] == true;
    if (err.response?.statusCode != 401 || usado == null || esReintento) {
      handler.next(err);
      return;
    }

    // Otra petición pudo renovar la sesión mientras esta esperaba.
    var token = tokenAcceso();
    if (token == null || 'Bearer $token' == usado) {
      if (!await renovar()) {
        handler.next(err);
        return;
      }
      token = tokenAcceso();
      if (token == null) {
        handler.next(err);
        return;
      }
    }

    final repetida = opciones.copyWith(
      headers: {...opciones.headers, _encabezado: 'Bearer $token'},
      extra: {...opciones.extra, _reintentada: true},
    );
    try {
      handler.resolve(await reintentar(repetida));
    } on DioException catch (error) {
      handler.next(error);
    }
  }
}
