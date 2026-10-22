import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:supera_paes/dominio/entidades/estado_salud.dart';
import 'package:supera_paes/nucleo/configuracion.dart';
import 'package:supera_paes/nucleo/constantes.dart';
import 'package:supera_paes/nucleo/errores.dart';
import 'package:supera_paes/nucleo/respuesta_api.dart';
import 'package:supera_paes/presentacion/aplicacion.dart';
import 'package:supera_paes/presentacion/comunes/secciones.dart';
import 'package:supera_paes/presentacion/enrutador.dart';
import 'package:supera_paes/presentacion/ingreso/pantalla_ingreso.dart';
import 'package:supera_paes/presentacion/inicio/estado_inicio.dart';

void main() {
  late ProviderContainer contenedor;

  setUp(() {
    contenedor = ProviderContainer(
      overrides: [
        estadoSaludProvider.overrideWith(
          (ref) async => const EstadoSalud(estado: 'ok', baseDeDatos: 'ok'),
        ),
      ],
    );
  });

  tearDown(() => contenedor.dispose());

  Future<void> iniciarApp(WidgetTester tester) async {
    // Teléfono de referencia del diseño: 390 × 844.
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: contenedor,
        child: const AplicacionSuperaPaes(),
      ),
    );
    await tester.pumpAndSettle();
  }

  Future<void> ir(WidgetTester tester, String ruta) async {
    contenedor.read(enrutadorProvider).go(ruta);
    await tester.pumpAndSettle();
  }

  test('las 16 pantallas del prototipo están declaradas una sola vez', () {
    expect(secciones, hasLength(16));
    expect(secciones.map((s) => s.ruta).toSet(), hasLength(16));
    // Barra inferior del DAS 7.4: Planes pasa a Perfil.
    expect(pestanas.map((s) => s.etiquetaPestana ?? s.titulo), [
      'Inicio',
      'Practicar',
      'Evaluaciones',
      'Progreso',
      'Perfil',
    ]);
  });

  testWidgets('abre en Iniciar sesión, con el logo y sin barra inferior', (
    tester,
  ) async {
    await iniciarApp(tester);

    expect(find.widgetWithText(AppBar, 'Iniciar sesión'), findsOneWidget);
    expect(find.image(const AssetImage(PantallaIngreso.logo)), findsOneWidget);
    expect(find.byType(NavigationBar), findsNothing);
  });

  testWidgets('navega a todas las pantallas', (tester) async {
    await iniciarApp(tester);

    for (final seccion in secciones) {
      await ir(tester, seccion.ruta);

      expect(
        find.widgetWithText(AppBar, seccion.titulo),
        findsOneWidget,
        reason: 'La ruta ${seccion.ruta} debe mostrar ${seccion.titulo}',
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
    await iniciarApp(tester);
    await ir(tester, Rutas.inicio);

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
    await iniciarApp(tester);
    await ir(tester, Rutas.inicio);

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
    await iniciarApp(tester);
    await ir(tester, Rutas.inicio);

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
