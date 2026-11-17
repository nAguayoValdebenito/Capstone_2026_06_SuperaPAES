import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:supera_paes/dominio/entidades/perfil_estudiante.dart';
import 'package:supera_paes/dominio/entidades/sesion_estudiante.dart';
import 'package:supera_paes/nucleo/constantes.dart';
import 'package:supera_paes/nucleo/tema.dart';
import 'package:supera_paes/presentacion/aplicacion.dart';
import 'package:supera_paes/presentacion/comunes/estado_cuenta.dart';
import 'package:supera_paes/presentacion/comunes/trazo.dart';
import 'package:supera_paes/presentacion/enrutador.dart';

import 'apoyo/app_de_prueba.dart';
import 'apoyo/repositorio_cuentas_falso.dart';
import 'apoyo/repositorio_perfil_falso.dart';

class _AlmacenPendiente extends AlmacenSesionEnMemoria {
  final lectura = Completer<SesionEstudiante?>();

  @override
  Future<SesionEstudiante?> leer() => lectura.future;
}

class _PerfilPendiente extends RepositorioPerfilFalso {
  final lectura = Completer<PerfilEstudiante>();

  @override
  Future<PerfilEstudiante> obtener() => lectura.future;
}

final Finder _apertura = find.byKey(const ValueKey('apertura-inicial'));
final Finder _linea = find.byKey(const ValueKey('linea-espera-apertura'));

SimboloLogo _simbolo(WidgetTester tester) => tester.widget<SimboloLogo>(
  find.descendant(of: _apertura, matching: find.byType(SimboloLogo)),
);

double _opacidad(WidgetTester tester) => tester
    .widget<Opacity>(find.byKey(const ValueKey('fundido-apertura')))
    .opacity;

Future<void> _montar(
  WidgetTester tester,
  ProviderContainer contenedor, {
  bool reducida = false,
  Size tamano = const Size(390, 844),
}) async {
  tester.view
    ..physicalSize = tamano
    ..devicePixelRatio = 1;
  tester.platformDispatcher.accessibilityFeaturesTestValue =
      FakeAccessibilityFeatures(disableAnimations: reducida);
  addTearDown(tester.view.reset);
  addTearDown(tester.platformDispatcher.clearAccessibilityFeaturesTestValue);
  await tester.pumpWidget(
    UncontrolledProviderScope(
      container: contenedor,
      child: const AplicacionSuperaPaes(),
    ),
  );
  await tester.pump();
}

void main() {
  testWidgets('trazo 400 ms, pausa 250 ms y fundido 300 ms con sesión rápida', (
    tester,
  ) async {
    final contenedor = crearContenedor(sesion: sesionDeEjemplo);
    await _montar(tester, contenedor);
    expect(_simbolo(tester).avance, 0);
    expect(_opacidad(tester), 1);
    expect(_linea, findsNothing);
    await tester.pump(const Duration(milliseconds: 200));
    expect(_simbolo(tester).avance, allOf(greaterThan(0), lessThan(1)));
    await tester.pump(const Duration(milliseconds: 200));
    expect(_simbolo(tester).avance, 1);
    await tester.pump(const Duration(milliseconds: 249));
    expect(_opacidad(tester), 1);
    await tester.pump(const Duration(milliseconds: 1));
    expect(_opacidad(tester), 1);
    // El controlador completa su simulación al superar el límite;
    // igualarlo deja pendiente la notificación del estado final.
    await tester.pump(const Duration(microseconds: 1));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 150));
    expect(_opacidad(tester), closeTo(0.5, 0.001));
    await tester.pump(const Duration(milliseconds: 150));
    expect(_opacidad(tester), 0);
    await tester.pump(const Duration(microseconds: 1));
    expect(_apertura, findsNothing);
    expect(rutaActual(contenedor), Rutas.inicio);
    expect(_linea, findsNothing);
  });

  testWidgets(
    'sin sesión revela el ingreso y bloquea los toques mientras abre',
    (tester) async {
      final contenedor = crearContenedor();
      await _montar(tester, contenedor);
      expect(find.text('Entrar').hitTestable(), findsNothing);
      await tester.pumpAndSettle();
      expect(_apertura, findsNothing);
      expect(find.text('Entrar').hitTestable(), findsOne);
      expect(rutaActual(contenedor), Rutas.ingreso);
    },
  );

  testWidgets('sesión lenta: línea solo después de 1 s, sin rueda', (
    tester,
  ) async {
    final almacen = _AlmacenPendiente();
    final contenedor = crearContenedor(almacen: almacen);
    await _montar(tester, contenedor);
    await tester.pump(const Duration(milliseconds: 999));
    expect(_apertura, findsOne);
    expect(_simbolo(tester).avance, 1);
    expect(_linea, findsNothing);
    await tester.pump(const Duration(milliseconds: 1));
    expect(_linea, findsOne);
    expect(find.byType(LinearProgressIndicator), findsOne);
    expect(find.byType(CircularProgressIndicator), findsNothing);
    almacen.lectura.complete(sesionDeEjemplo);
    await tester.pumpAndSettle();
    expect(_apertura, findsNothing);
    expect(rutaActual(contenedor), Rutas.inicio);
  });

  testWidgets(
    'espera el perfil y revela directamente su primer paso si falta',
    (tester) async {
      final perfil = _PerfilPendiente();
      final contenedor = crearContenedor(
        sesion: sesionDeEjemplo,
        perfil: perfil,
      );
      await _montar(tester, contenedor);
      await tester.pump(const Duration(milliseconds: 1100));
      expect(_apertura, findsOne);
      expect(_linea, findsOne);
      perfil.lectura.complete(perfilVacio);
      await tester.pumpAndSettle();
      expect(_apertura, findsNothing);
      expect(rutaActual(contenedor), Rutas.perfilCurso);
    },
  );

  testWidgets('un error de lectura de sesión conserva la salida al ingreso', (
    tester,
  ) async {
    final almacen = _AlmacenPendiente();
    final contenedor = crearContenedor(almacen: almacen);
    await _montar(tester, contenedor);
    almacen.lectura.completeError(StateError('No se pudo leer el almacén.'));
    await tester.pumpAndSettle();
    expect(_apertura, findsNothing);
    expect(rutaActual(contenedor), Rutas.ingreso);
    expect(tester.takeException(), isNull);
  });

  testWidgets('la apertura no reemplaza la dirección pública solicitada', (
    tester,
  ) async {
    final contenedor = crearContenedor();
    await _montar(tester, contenedor);
    contenedor.read(enrutadorProvider).go(Rutas.privacidad);
    await tester.pumpAndSettle();
    expect(_apertura, findsNothing);
    expect(rutaActual(contenedor), Rutas.privacidad);
  });

  testWidgets(
    'movimiento reducido: símbolo completo en el primer cuadro y corte',
    (tester) async {
      final almacen = _AlmacenPendiente();
      final contenedor = crearContenedor(almacen: almacen);
      await _montar(tester, contenedor, reducida: true);
      expect(_simbolo(tester).avance, 1);
      expect(_opacidad(tester), 1);
      expect(tester.binding.hasScheduledFrame, isFalse);
      almacen.lectura.complete(null);
      await tester.pump();
      await tester.pump();
      await tester.pump();
      expect(_apertura, findsNothing);
      expect(rutaActual(contenedor), Rutas.ingreso);
    },
  );

  testWidgets('espera reducida: línea estática sin animación continua', (
    tester,
  ) async {
    final almacen = _AlmacenPendiente();
    final contenedor = crearContenedor(almacen: almacen);
    await _montar(tester, contenedor, reducida: true);
    await tester.pump(const Duration(seconds: 1));
    expect(_linea, findsOne);
    expect(find.byType(LinearProgressIndicator), findsNothing);
    expect(tester.binding.hasScheduledFrame, isFalse);
    almacen.lectura.complete(null);
    await tester.pumpAndSettle();
    expect(_apertura, findsNothing);
  });

  testWidgets('activar movimiento reducido durante el trazo lo completa', (
    tester,
  ) async {
    final almacen = _AlmacenPendiente();
    final contenedor = crearContenedor(almacen: almacen);
    await _montar(tester, contenedor);
    await tester.pump(const Duration(milliseconds: 200));
    tester.platformDispatcher.accessibilityFeaturesTestValue =
        const FakeAccessibilityFeatures(disableAnimations: true);
    await tester.pump();
    expect(_simbolo(tester).avance, 1);
    expect(_opacidad(tester), 1);
    almacen.lectura.complete(null);
    await tester.pumpAndSettle();
    expect(_apertura, findsNothing);
    expect(tester.takeException(), isNull);
  });

  for (final tamano in [const Size(360, 640), const Size(768, 1024)]) {
    testWidgets('símbolo centrado y sin desborde con letra 2,0 en $tamano', (
      tester,
    ) async {
      final almacen = _AlmacenPendiente();
      final contenedor = crearContenedor(almacen: almacen);
      tester.platformDispatcher.textScaleFactorTestValue = 2;
      addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
      await _montar(tester, contenedor, tamano: tamano);
      final simbolo = find.descendant(
        of: _apertura,
        matching: find.byType(SimboloLogo),
      );
      expect(tester.getCenter(simbolo), tamano.center(Offset.zero));
      expect(
        tester.getSize(simbolo).width,
        TemaSuperaPaes.anchoSimboloApertura,
      );
      await tester.pump(const Duration(milliseconds: 1001));
      expect(tester.getCenter(simbolo), tamano.center(Offset.zero));
      expect(tester.takeException(), isNull);
      almacen.lectura.complete(null);
      await tester.pumpAndSettle();
    });
  }

  testWidgets('cerrar sesión después del arranque no repite la apertura', (
    tester,
  ) async {
    final contenedor = crearContenedor(sesion: sesionDeEjemplo);
    await _montar(tester, contenedor);
    await tester.pumpAndSettle();
    await contenedor.read(sesionProvider.notifier).cerrar();
    await tester.pumpAndSettle();
    expect(_apertura, findsNothing);
    expect(rutaActual(contenedor), Rutas.ingreso);
  });

  testWidgets('desmontar cancela el umbral y los controladores', (
    tester,
  ) async {
    final almacen = _AlmacenPendiente();
    final contenedor = crearContenedor(almacen: almacen);
    await _montar(tester, contenedor);
    await tester.pump(const Duration(milliseconds: 200));
    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pump(const Duration(seconds: 2));
    almacen.lectura.complete(null);
    expect(tester.takeException(), isNull);
    expect(tester.binding.hasScheduledFrame, isFalse);
  });
}
