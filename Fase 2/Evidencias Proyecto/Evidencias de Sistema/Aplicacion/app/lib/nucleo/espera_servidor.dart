import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Si la API tarda en responder (A-10). Render gratuito se suspende tras 15
/// minutos sin tráfico y tarda cerca de un minuto en despertar (DAS 2.5): sin
/// aviso, la app parecería colgada.
final esperaServidorProvider = NotifierProvider<EsperaServidor, bool>(
  EsperaServidor.new,
);

class EsperaServidor extends Notifier<bool> {
  /// Lo que se espera antes de avisar: las respuestas normales no lo ven.
  static const Duration paciencia = Duration(seconds: 5);

  int _pendientes = 0;
  Timer? _temporizador;

  @override
  bool build() {
    ref.onDispose(() => _temporizador?.cancel());
    return false;
  }

  void empezo() {
    _pendientes++;
    _temporizador ??= Timer(paciencia, () => state = true);
  }

  void termino() {
    if (_pendientes > 0) _pendientes--;
    if (_pendientes > 0) return;
    _temporizador?.cancel();
    _temporizador = null;
    state = false;
  }
}

/// Cuenta las peticiones en curso de un cliente HTTP. Va primero: así una
/// petición que otro interceptor repite se cuenta una vez por intento.
class InterceptorEspera extends Interceptor {
  InterceptorEspera(this._espera);

  final EsperaServidor _espera;

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    _espera.empezo();
    handler.next(options);
  }

  @override
  void onResponse(
    Response<dynamic> response,
    ResponseInterceptorHandler handler,
  ) {
    _espera.termino();
    handler.next(response);
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) {
    _espera.termino();
    handler.next(err);
  }
}
