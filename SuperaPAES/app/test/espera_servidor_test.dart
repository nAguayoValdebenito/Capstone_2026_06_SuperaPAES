import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:supera_paes/nucleo/cliente_http.dart';
import 'package:supera_paes/presentacion/comunes/estado_cuenta.dart';

import 'apoyo/app_de_prueba.dart';

const _aviso =
    'Estamos despertando el servidor. Puede tardar cerca de un minuto.';

/// Deja cada petición esperando hasta que la prueba la responda o la falle.
class _AdaptadorQueEspera implements HttpClientAdapter {
  final List<Completer<ResponseBody>> pendientes = [];

  void responder(int indice) => pendientes[indice].complete(
    ResponseBody.fromString(
      jsonEncode({'data': null, 'error': null, 'meta': null}),
      200,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      },
    ),
  );

  void fallar(int indice) => pendientes[indice].completeError(
    DioException.connectionError(
      requestOptions: RequestOptions(path: '/'),
      reason: 'sin red',
    ),
  );

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) {
    final pendiente = Completer<ResponseBody>();
    pendientes.add(pendiente);
    return pendiente.future;
  }

  @override
  void close({bool force = false}) {}
}

/// Abre la app y conecta el adaptador al cliente indicado.
Future<(Dio, _AdaptadorQueEspera)> _preparar(
  WidgetTester tester,
  Provider<Dio> cliente,
) async {
  final contenedor = crearContenedor();
  await iniciarApp(tester, contenedor);
  final dio = contenedor.read(cliente);
  final adaptador = _AdaptadorQueEspera();
  dio.httpClientAdapter = adaptador;
  return (dio, adaptador);
}

/// Pide `ruta` sin esperarla: el reloj de la prueba solo avanza con `pump`.
void _pedir(Dio dio, String ruta) =>
    unawaited(dio.get<Object?>(ruta).then<void>((_) {}, onError: (_) {}));

/// Deja que la petición llegue al adaptador o que termine su respuesta.
Future<void> _asentar(WidgetTester tester) async {
  for (var i = 0; i < 5; i++) {
    await tester.pump();
  }
}

Future<void> _esperar(WidgetTester tester, int segundos) async {
  await _asentar(tester);
  await tester.pump(Duration(seconds: segundos));
  await _asentar(tester);
}

void main() {
  group('espera del servidor (A-10)', () {
    test('el tiempo de espera alcanza para que Render despierte', () {
      final opciones = crearContenedor().read(clienteHttpProvider).options;

      expect(opciones.receiveTimeout, const Duration(seconds: 75));
      expect(opciones.connectTimeout, const Duration(seconds: 15));
    });

    testWidgets('una respuesta rápida no muestra ningún aviso', (tester) async {
      final (dio, adaptador) = await _preparar(tester, clienteHttpProvider);

      _pedir(dio, '/rapida');
      await _esperar(tester, 4);
      expect(find.text(_aviso), findsNothing);

      adaptador.responder(0);
      await _esperar(tester, 2);

      expect(find.text(_aviso), findsNothing);
    });

    testWidgets('a los 5 s avisa, y el aviso se va con la respuesta', (
      tester,
    ) async {
      final (dio, adaptador) = await _preparar(tester, clienteHttpProvider);

      _pedir(dio, '/lenta');
      await _esperar(tester, 5);
      expect(find.text(_aviso), findsOneWidget);

      adaptador.responder(0);
      await _esperar(tester, 1);

      expect(find.text(_aviso), findsNothing);
    });

    testWidgets('también avisa en las rutas con sesión', (tester) async {
      final (dio, adaptador) = await _preparar(
        tester,
        clienteHttpConSesionProvider,
      );

      _pedir(dio, '/con-sesion');
      await _esperar(tester, 5);
      expect(find.text(_aviso), findsOneWidget);

      adaptador.responder(0);
      await _esperar(tester, 1);

      expect(find.text(_aviso), findsNothing);
    });

    testWidgets('sigue mientras quede una petición, y una falla lo saca', (
      tester,
    ) async {
      final (dio, adaptador) = await _preparar(tester, clienteHttpProvider);

      _pedir(dio, '/uno');
      _pedir(dio, '/dos');
      await _esperar(tester, 5);

      adaptador.responder(0);
      await _esperar(tester, 1);
      expect(find.text(_aviso), findsOneWidget);

      adaptador.fallar(1);
      await _esperar(tester, 1);

      expect(find.text(_aviso), findsNothing);
    });

    testWidgets('no tapa los toques ni desborda con letra grande', (
      tester,
    ) async {
      tester.platformDispatcher.textScaleFactorTestValue = 2;
      addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
      final (dio, adaptador) = await _preparar(tester, clienteHttpProvider);
      tester.view.physicalSize = const Size(360, 640);

      _pedir(dio, '/lenta');
      await _esperar(tester, 5);

      expect(tester.takeException(), isNull);
      expect(find.text(_aviso), findsOneWidget);
      expect(
        find.ancestor(
          of: find.text(_aviso),
          matching: find.byType(IgnorePointer),
        ),
        findsWidgets,
      );

      adaptador.responder(0);
      await _esperar(tester, 1);
    });
  });
}
