import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:supera_paes/nucleo/configuracion.dart';
import 'package:supera_paes/nucleo/constantes.dart';
import 'package:supera_paes/nucleo/errores.dart';
import 'package:supera_paes/nucleo/respuesta_api.dart';
import 'package:supera_paes/presentacion/comunes/secciones.dart';
import 'package:supera_paes/presentacion/ingreso/pantalla_ingreso.dart';

import 'apoyo/app_de_prueba.dart';
import 'apoyo/repositorio_cuentas_falso.dart';

void main() {
  test('las 17 pantallas de la app están declaradas una sola vez', () {
    expect(secciones, hasLength(17));
    expect(secciones.map((s) => s.ruta).toSet(), hasLength(17));
    // Barra inferior del DAS 7.4: Planes pasa a Perfil.
    expect(pestanas.map((s) => s.etiquetaPestana ?? s.titulo), [
      'Inicio',
      'Practicar',
      'Evaluaciones',
      'Progreso',
      'Perfil',
    ]);
  });

  testWidgets('sin sesión abre en Iniciar sesión, con el logo y sin barra '
      'inferior', (tester) async {
    final contenedor = crearContenedor();
    await iniciarApp(tester, contenedor);

    expect(rutaActual(contenedor), Rutas.ingreso);
    expect(find.image(const AssetImage(PantallaIngreso.logo)), findsOneWidget);
    expect(find.byType(NavigationBar), findsNothing);
  });

  testWidgets('con sesión navega a todas las pantallas', (tester) async {
    final contenedor = crearContenedor(sesion: sesionDeEjemplo);
    await iniciarApp(tester, contenedor);

    // Con sesión, Iniciar sesión lleva a Inicio (se prueba en sesion_test).
    for (final seccion in secciones.where((s) => s.ruta != Rutas.ingreso)) {
      await ir(tester, contenedor, seccion.ruta);

      expect(
        rutaActual(contenedor),
        seccion.ruta,
        reason: 'La ruta ${seccion.ruta} debe abrir ${seccion.titulo}',
      );
      expect(
        find.byType(NavigationBar),
        seccion.esPestana ? findsOneWidget : findsNothing,
        reason:
            'Solo las pestañas muestran la barra inferior (${seccion.ruta})',
      );
    }
  });

  testWidgets('la barra inferior cambia de pestaña', (tester) async {
    await iniciarApp(
      tester,
      crearContenedor(sesion: sesionDeEjemplo),
      ruta: Rutas.inicio,
    );

    await tester.tap(find.text('Practicar'));
    await tester.pumpAndSettle();
    expect(find.widgetWithText(AppBar, 'Elegir práctica'), findsOneWidget);

    await tester.tap(find.text('Evaluaciones').last);
    await tester.pumpAndSettle();
    expect(find.widgetWithText(AppBar, 'Evaluaciones'), findsOneWidget);
  });

  testWidgets('desde Perfil se abren los Planes y se vuelve atrás', (
    tester,
  ) async {
    await iniciarApp(
      tester,
      crearContenedor(sesion: sesionDeEjemplo),
      ruta: Rutas.inicio,
    );

    await tester.tap(find.text('Perfil').last);
    await tester.pumpAndSettle();
    expect(find.widgetWithText(AppBar, 'Perfil'), findsOneWidget);
    expect(find.text('Puntajes PAES'), findsOneWidget);

    final botonPlanes = find.widgetWithText(OutlinedButton, 'Planes');
    await tester.scrollUntilVisible(botonPlanes, 200);
    await tester.tap(botonPlanes);
    await tester.pumpAndSettle();
    expect(find.widgetWithText(AppBar, 'Planes'), findsOneWidget);
    expect(find.byType(NavigationBar), findsNothing);

    await tester.tap(find.byType(BackButton));
    await tester.pumpAndSettle();
    expect(find.widgetWithText(AppBar, 'Perfil'), findsOneWidget);
  });

  testWidgets('Inicio muestra el estado de la API', (tester) async {
    await iniciarApp(
      tester,
      crearContenedor(sesion: sesionDeEjemplo),
      ruta: Rutas.inicio,
    );

    expect(find.text('API: ok'), findsOneWidget);
    expect(find.text('Base de datos: ok'), findsOneWidget);
  });

  group('Configuracion sin API_URL en depuración', () {
    tearDown(() => debugDefaultTargetPlatformOverride = null);

    test('el emulador de Android usa 10.0.2.2', () {
      debugDefaultTargetPlatformOverride = TargetPlatform.android;
      expect(Configuracion.apiUrl, 'http://10.0.2.2:3000');
    });

    test('el simulador de iOS usa localhost', () {
      debugDefaultTargetPlatformOverride = TargetPlatform.iOS;
      expect(Configuracion.apiUrl, 'http://localhost:3000');
    });
  });

  group('leerData', () {
    test('devuelve data cuando no hay error', () {
      expect(
        leerData({
          'data': {'estado': 'ok'},
          'error': null,
          'meta': null,
        }),
        {'estado': 'ok'},
      );
    });

    test('lanza ErrorApi con el error de la API', () {
      expect(
        () => leerData({
          'data': null,
          'error': {
            'codigo': 'NO_AUTENTICADO',
            'mensaje': 'Debes iniciar sesión.',
          },
          'meta': null,
        }, estadoHttp: 401),
        throwsA(
          isA<ErrorApi>().having((e) => e.codigo, 'codigo', 'NO_AUTENTICADO'),
        ),
      );
    });

    test('rechaza un cuerpo sin el formato común', () {
      expect(
        () => leerData({'estado': 'ok'}),
        throwsA(
          isA<ErrorApi>().having(
            (e) => e.codigo,
            'codigo',
            'RESPUESTA_INVALIDA',
          ),
        ),
      );
    });
  });
}
