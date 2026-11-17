import 'package:flutter/foundation.dart';

/// Configuración que llega al compilar con
/// `--dart-define-from-file=config/desarrollo.json`
/// (o `--dart-define=API_URL=...`).
/// Nunca contiene claves: todo lo que se compila en la app lo puede leer
/// cualquiera.
abstract final class Configuracion {
  static const String _apiUrlDefinida = String.fromEnvironment('API_URL');

  /// API local en depuración: el emulador de Android llega al computador por
  /// `10.0.2.2`; el simulador de iOS, por `localhost`.
  static String get _apiUrlDesarrollo =>
      defaultTargetPlatform == TargetPlatform.iOS
      ? 'http://localhost:3000'
      : 'http://10.0.2.2:3000';

  /// URL base de la API, sin barra final. Fuera de depuración (profile y
  /// release), una compilación sin `API_URL` o con una `API_URL` que no use
  /// https falla al iniciar en vez de apuntar a una dirección local o enviar
  /// contraseñas y tokens sin cifrar.
  static String get apiUrl =>
      resolverApiUrl(definida: _apiUrlDefinida, depuracion: kDebugMode);

  /// La regla de [apiUrl], aparte para probarla en los dos modos.
  @visibleForTesting
  static String resolverApiUrl({
    required String definida,
    required bool depuracion,
  }) {
    if (definida.isEmpty) {
      if (depuracion) return _apiUrlDesarrollo;
      throw StateError(
        'Falta API_URL: compila con --dart-define=API_URL=https://<api>.',
      );
    }
    if (!depuracion && !definida.startsWith('https://')) {
      throw StateError(
        'API_URL debe usar https:// fuera de depuración: compila con '
        '--dart-define=API_URL=https://<api>.',
      );
    }
    return definida;
  }

  /// Se llama al iniciar la app: así una configuración incompleta se nota de
  /// inmediato.
  static void verificar() => apiUrl;
}
