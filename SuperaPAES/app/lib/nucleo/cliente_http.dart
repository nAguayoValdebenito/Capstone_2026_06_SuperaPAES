import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:supera_paes/nucleo/configuracion.dart';

/// Cliente HTTP único de la app, apuntando a /api/v1/app de la API.
/// La única ruta fuera de /app es la salud ([Configuracion.urlSalud]).
final clienteHttpProvider = Provider<Dio>((ref) {
  final dio = Dio(
    BaseOptions(
      baseUrl: '${Configuracion.apiUrl}/api/v1/app',
      connectTimeout: const Duration(seconds: 5),
      receiveTimeout: const Duration(seconds: 10),
      headers: const {'Accept': 'application/json'},
    ),
  );
  ref.onDispose(dio.close);
  return dio;
});
