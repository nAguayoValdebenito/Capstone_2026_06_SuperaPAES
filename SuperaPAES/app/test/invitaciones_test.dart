import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:supera_paes/datos/fuentes/fuente_cupo_remota.dart';
import 'package:supera_paes/nucleo/constantes.dart';
import 'package:supera_paes/nucleo/errores.dart';

import 'apoyo/adaptador_http_falso.dart';
import 'apoyo/app_de_prueba.dart';
import 'apoyo/repositorio_cuentas_falso.dart';
import 'apoyo/repositorio_cupo_falso.dart';

/// Lo que se copia al portapapeles, sin la plataforma.
List<String> _portapapeles(WidgetTester tester) {
  final copiados = <String>[];
  tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
    SystemChannels.platform,
    (llamada) async {
      if (llamada.method == 'Clipboard.setData') {
        copiados.add(
          (llamada.arguments as Map<Object?, Object?>)['text']! as String,
        );
      }
      return null;
    },
  );
  addTearDown(
    () => tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
      SystemChannels.platform,
      null,
    ),
  );
  return copiados;
}

void main() {
  test(
    'pide las invitaciones con GET a /cupo-invitaciones/invitaciones',
    () async {
      final adaptador = AdaptadorHttpFalso(
        (_) => respuestaOk({
          'codigo': 'K7P2QX',
          'link': 'https://consola.superapaes.cl/invitar/K7P2QX',
          'registrados': 3,
          'verificados': 1,
        }),
      );

      final invitaciones = await FuenteCupoRemota(
        Dio()..httpClientAdapter = adaptador,
      ).misInvitaciones();

      expect(adaptador.peticiones.single.method, 'GET');
      expect(
        adaptador.peticiones.single.path,
        '/cupo-invitaciones/invitaciones',
      );
      expect(invitaciones.codigo, 'K7P2QX');
      expect(invitaciones.registrados, 3);
      expect(invitaciones.verificados, 1);
    },
  );

  group('Invitar (A38)', () {
    testWidgets('Perfil abre A38 con el link, el código y los contadores', (
      tester,
    ) async {
      final contenedor = crearContenedor(sesion: sesionDeEjemplo);
      await iniciarApp(tester, contenedor, ruta: Rutas.perfil);

      await tocar(tester, find.text('Invitar y ganar preguntas'));

      expect(rutaActual(contenedor), Rutas.invitaciones);
      expect(find.text('Invita y gana preguntas'), findsOne);
      expect(
        find.text('https://consola.superapaes.cl/invitar/K7P2QX'),
        findsOne,
      );
      expect(find.text('K7P2QX'), findsOne);
      expect(find.text('3'), findsOne);
      expect(find.text('registrados'), findsOne);
      expect(find.text('1'), findsOne);
      expect(find.text('verificados'), findsOne);
    });

    testWidgets('«Compartir invitación» envía el código y el link (CU-11 '
        'paso 3)', (tester) async {
      final compartidos = <String>[];
      await iniciarApp(
        tester,
        crearContenedor(
          sesion: sesionDeEjemplo,
          compartirTexto: (texto) async => compartidos.add(texto),
        ),
        ruta: Rutas.invitaciones,
      );

      await tocar(tester, find.text('Compartir invitación'));

      expect(compartidos, hasLength(1));
      expect(compartidos.single, contains('escribe mi código K7P2QX'));
      expect(
        compartidos.single,
        endsWith('https://consola.superapaes.cl/invitar/K7P2QX'),
      );
    });

    testWidgets('copia el link y el código, y lo avisa', (tester) async {
      final copiados = _portapapeles(tester);
      await iniciarApp(
        tester,
        crearContenedor(sesion: sesionDeEjemplo),
        ruta: Rutas.invitaciones,
      );

      await tocar(tester, find.byTooltip('Copiar código'));
      expect(find.text('Código copiado.'), findsOne);
      await tocar(tester, find.byTooltip('Copiar link'));

      expect(copiados, [
        'K7P2QX',
        'https://consola.superapaes.cl/invitar/K7P2QX',
      ]);
    });

    testWidgets('si no carga, muestra el error y «Reintentar» lo vuelve a '
        'pedir', (tester) async {
      final cupo = RepositorioCupoFalso()
        ..errorInvitaciones = const ErrorApi(
          codigo: 'SIN_CONEXION',
          mensaje: 'No hay conexión con el servidor.',
        );
      await iniciarApp(
        tester,
        crearContenedor(sesion: sesionDeEjemplo, cupo: cupo),
        ruta: Rutas.invitaciones,
      );

      expect(find.text('No hay conexión con el servidor.'), findsOne);
      expect(find.text('Compartir invitación'), findsNothing);

      cupo.errorInvitaciones = null;
      await tocar(tester, find.text('Reintentar'));
      expect(find.text('K7P2QX'), findsOne);
    });

    testWidgets('con la letra al doble no se desborda (RNF-12)', (
      tester,
    ) async {
      tester.platformDispatcher.textScaleFactorTestValue = 2;
      addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);

      await iniciarApp(
        tester,
        crearContenedor(sesion: sesionDeEjemplo),
        ruta: Rutas.invitaciones,
      );
      await tester.scrollUntilVisible(
        find.text('verificados'),
        200,
        scrollable: find.byType(Scrollable).first,
      );

      expect(tester.takeException(), isNull);
    });
  });
}
