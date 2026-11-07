import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:supera_paes/nucleo/constantes.dart';
import 'package:supera_paes/nucleo/errores.dart';
import 'package:supera_paes/presentacion/comunes/boton_principal.dart';
import 'package:supera_paes/presentacion/comunes/logo_acceso.dart';

import 'apoyo/app_de_prueba.dart';
import 'apoyo/repositorio_cuentas_falso.dart';

class _RecuperacionPendiente extends RepositorioCuentasFalso {
  final respuestas = [Completer<void>(), Completer<void>()];

  @override
  Future<void> solicitarRecuperacion(String correo) {
    recuperaciones.add(correo);
    return respuestas[recuperaciones.length - 1].future;
  }
}

BotonPrincipal _boton(WidgetTester tester) =>
    tester.widget<BotonPrincipal>(find.byType(BotonPrincipal));

Future<void> _pulsar(WidgetTester tester) async {
  await tester.pumpAndSettle();
  await tester.scrollUntilVisible(
    find.byType(BotonPrincipal),
    200,
    scrollable: find.byType(Scrollable).first,
  );
  await tester.ensureVisible(find.byType(BotonPrincipal));
  await tester.pumpAndSettle();
  expect(find.byType(BotonPrincipal).hitTestable(), findsOne);
  await tester.tap(find.byType(BotonPrincipal));
  await tester.pump();
}

void main() {
  testWidgets(
    'A04 usa el logo y valida antes de enviar; editar limpia el error',
    (tester) async {
      final cuentas = RepositorioCuentasFalso();
      final contenedor = crearContenedor(repositorio: cuentas);
      await iniciarApp(tester, contenedor, ruta: Rutas.recuperarContrasena);
      expect(find.byType(LogoAcceso), findsOne);
      await _pulsar(tester);
      await tester.pumpAndSettle();
      expect(_boton(tester).estado, EstadoBoton.error);
      expect(find.text('Ingresa un correo válido.'), findsOne);
      expect(cuentas.recuperaciones, isEmpty);
      await tester.enterText(campo('Correo'), 'prueba@ejemplo.test');
      await tester.pump();
      expect(_boton(tester).estado, EstadoBoton.normal);
    },
  );

  testWidgets(
    'envío y reenvío lentos bloquean duplicados y confirman el mismo correo',
    (tester) async {
      final cuentas = _RecuperacionPendiente();
      final contenedor = crearContenedor(repositorio: cuentas);
      await iniciarApp(tester, contenedor, ruta: Rutas.recuperarContrasena);
      await tester.enterText(campo('Correo'), '  prueba@ejemplo.test  ');
      await _pulsar(tester);
      expect(_boton(tester).estado, EstadoBoton.cargando);
      expect(tester.widget<TextField>(campo('Correo')).enabled, isFalse);
      await tester.tap(find.byType(BotonPrincipal));
      await tester.pump(const Duration(milliseconds: 200));
      expect(cuentas.recuperaciones, ['prueba@ejemplo.test']);
      expect(find.textContaining('Revisa tu correo.'), findsNothing);
      cuentas.respuestas[0].complete();
      await tester.pump();
      await tester.pump();
      expect(_boton(tester).estado, EstadoBoton.exito);
      await tester.pump(const Duration(milliseconds: 300));
      expect(find.textContaining('Revisa tu correo.'), findsNothing);
      await tester.pumpAndSettle();
      expect(_boton(tester).texto, 'Reenviar enlace');
      expect(
        find.textContaining('Si prueba@ejemplo.test está registrado'),
        findsOne,
      );
      await _pulsar(tester);
      expect(_boton(tester).estado, EstadoBoton.cargando);
      await tester.tap(find.byType(BotonPrincipal));
      await tester.pump(const Duration(milliseconds: 200));
      expect(cuentas.recuperaciones, [
        'prueba@ejemplo.test',
        'prueba@ejemplo.test',
      ]);
      cuentas.respuestas[1].complete();
      await tester.pumpAndSettle();
      expect(find.textContaining('Te enviamos otro enlace.'), findsOne);
      expect(_boton(tester).estado, EstadoBoton.normal);
      expect(rutaActual(contenedor), Rutas.recuperarContrasena);
    },
  );

  testWidgets('un error de campo de la API se mantiene bajo el correo', (
    tester,
  ) async {
    final cuentas = RepositorioCuentasFalso()
      ..errorAlRecuperar = const ErrorApi(
        codigo: 'VALIDACION',
        mensaje: 'Revisa el formulario.',
        problemas: [
          ProblemaDeCampo(
            ruta: 'correo',
            mensaje: 'Revisa este correo antes de continuar.',
          ),
        ],
      );
    final contenedor = crearContenedor(repositorio: cuentas);
    await iniciarApp(tester, contenedor, ruta: Rutas.recuperarContrasena);
    await tester.enterText(campo('Correo'), 'prueba@ejemplo.test');
    await _pulsar(tester);
    await tester.pumpAndSettle();
    expect(
      tester.widget<TextField>(campo('Correo')).decoration?.errorText,
      'Revisa este correo antes de continuar.',
    );
    expect(find.text('Revisa el formulario.'), findsNothing);
    expect(_boton(tester).estado, EstadoBoton.error);
    expect(find.textContaining('Revisa tu correo.'), findsNothing);
    await tester.enterText(campo('Correo'), 'otro@ejemplo.test');
    await tester.pumpAndSettle();
    expect(
      tester.widget<TextField>(campo('Correo')).decoration?.errorText,
      isNull,
    );
    expect(_boton(tester).estado, EstadoBoton.normal);
  });

  testWidgets(
    'cambiar el correo quita la confirmación y vuelve al envío inicial',
    (tester) async {
      final cuentas = RepositorioCuentasFalso();
      final contenedor = crearContenedor(repositorio: cuentas);
      await iniciarApp(tester, contenedor, ruta: Rutas.recuperarContrasena);
      await tester.enterText(campo('Correo'), 'prueba@ejemplo.test');
      await _pulsar(tester);
      await tester.pumpAndSettle();
      expect(_boton(tester).texto, 'Reenviar enlace');
      await tester.enterText(campo('Correo'), 'nuevo@ejemplo.test');
      await tester.pumpAndSettle();
      expect(_boton(tester).texto, 'Enviar enlace');
      expect(find.textContaining('Revisa tu correo.'), findsNothing);
      await _pulsar(tester);
      await tester.pumpAndSettle();
      expect(cuentas.recuperaciones, [
        'prueba@ejemplo.test',
        'nuevo@ejemplo.test',
      ]);
      expect(
        find.textContaining('Si nuevo@ejemplo.test está registrado'),
        findsOne,
      );
      expect(find.textContaining('Te enviamos otro enlace.'), findsNothing);
    },
  );

  for (final error in [
    const ErrorApi(codigo: 'SIN_CONEXION', mensaje: 'No se pudo conectar.'),
    const ErrorApi(
      codigo: 'DEMASIADOS_INTENTOS',
      mensaje: 'Espera antes de pedir otro enlace.',
      estadoHttp: 429,
    ),
  ]) {
    testWidgets(
      'error de reenvío conserva la confirmación y permite reintentar: '
      '${error.codigo}',
      (tester) async {
        final cuentas = RepositorioCuentasFalso();
        final contenedor = crearContenedor(repositorio: cuentas);
        await iniciarApp(tester, contenedor, ruta: Rutas.recuperarContrasena);
        await tester.enterText(campo('Correo'), 'prueba@ejemplo.test');
        await _pulsar(tester);
        await tester.pumpAndSettle();
        cuentas.errorAlRecuperar = error;
        await _pulsar(tester);
        await tester.pumpAndSettle();
        expect(_boton(tester).estado, EstadoBoton.error);
        expect(_boton(tester).texto, 'Reenviar enlace');
        expect(find.text(error.mensaje), findsOne);
        expect(find.textContaining('Revisa tu correo.'), findsOne);
        expect(find.textContaining('Te enviamos otro enlace.'), findsNothing);
        cuentas.errorAlRecuperar = null;
        await _pulsar(tester);
        await tester.pumpAndSettle();
        expect(cuentas.recuperaciones, List.filled(3, 'prueba@ejemplo.test'));
        expect(find.textContaining('Te enviamos otro enlace.'), findsOne);
        expect(find.text(error.mensaje), findsNothing);
      },
    );
  }

  testWidgets(
    'movimiento reducido muestra el logo final y confirma sin esperar',
    (tester) async {
      tester.platformDispatcher.accessibilityFeaturesTestValue =
          const FakeAccessibilityFeatures(disableAnimations: true);
      addTearDown(
        tester.platformDispatcher.clearAccessibilityFeaturesTestValue,
      );
      final contenedor = crearContenedor();
      await iniciarApp(tester, contenedor, ruta: Rutas.recuperarContrasena);
      final logo = tester.widget<ScaleTransition>(
        find.descendant(
          of: find.byType(LogoAcceso),
          matching: find.byType(ScaleTransition),
        ),
      );
      expect(logo.scale.value, 1);
      await tester.enterText(campo('Correo'), 'prueba@ejemplo.test');
      await _pulsar(tester);
      await tester.pump();
      await tester.pump();
      await tester.pump();
      expect(_boton(tester).estado, EstadoBoton.normal);
      expect(_boton(tester).texto, 'Reenviar enlace');
      expect(find.textContaining('Revisa tu correo.'), findsOne);
      await tester.pumpAndSettle();
    },
  );

  testWidgets('activar movimiento reducido termina la confirmación en curso', (
    tester,
  ) async {
    final contenedor = crearContenedor();
    await iniciarApp(tester, contenedor, ruta: Rutas.recuperarContrasena);
    await tester.enterText(campo('Correo'), 'prueba@ejemplo.test');
    await _pulsar(tester);
    await tester.pump();
    expect(_boton(tester).estado, EstadoBoton.exito);
    tester.platformDispatcher.accessibilityFeaturesTestValue =
        const FakeAccessibilityFeatures(disableAnimations: true);
    addTearDown(tester.platformDispatcher.clearAccessibilityFeaturesTestValue);
    await tester.pump();
    await tester.pump();
    expect(_boton(tester).texto, 'Reenviar enlace');
    expect(_boton(tester).estado, EstadoBoton.normal);
    expect(tester.takeException(), isNull);
    await tester.pumpAndSettle();
  });

  for (final reducida in [false, true]) {
    testWidgets('confirmación y reenvío con letra 2,0; reducido=$reducida', (
      tester,
    ) async {
      tester.platformDispatcher.textScaleFactorTestValue = 2;
      tester.platformDispatcher.accessibilityFeaturesTestValue =
          FakeAccessibilityFeatures(disableAnimations: reducida);
      addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
      addTearDown(
        tester.platformDispatcher.clearAccessibilityFeaturesTestValue,
      );
      final cuentas = RepositorioCuentasFalso();
      final contenedor = crearContenedor(repositorio: cuentas);
      await iniciarApp(tester, contenedor, ruta: Rutas.recuperarContrasena);
      await tester.enterText(campo('Correo'), 'prueba@ejemplo.test');
      await _pulsar(tester);
      await tester.pumpAndSettle();
      expect(
        find.textContaining('Si prueba@ejemplo.test está registrado'),
        findsOne,
      );
      await _pulsar(tester);
      await tester.pumpAndSettle();
      expect(find.textContaining('Te enviamos otro enlace.'), findsOne);
      expect(cuentas.recuperaciones, hasLength(2));
      expect(tester.takeException(), isNull);
    });
  }

  testWidgets(
    'desmontar durante la petición no actualiza la pantalla descartada',
    (tester) async {
      final cuentas = _RecuperacionPendiente();
      final contenedor = crearContenedor(repositorio: cuentas);
      await iniciarApp(tester, contenedor, ruta: Rutas.recuperarContrasena);
      await tester.enterText(campo('Correo'), 'prueba@ejemplo.test');
      await _pulsar(tester);
      await tester.pumpWidget(const SizedBox.shrink());
      cuentas.respuestas[0].complete();
      await tester.pump(const Duration(seconds: 1));
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    'desmontar durante el éxito libera el controlador de confirmación',
    (tester) async {
      final contenedor = crearContenedor();
      await iniciarApp(tester, contenedor, ruta: Rutas.recuperarContrasena);
      await tester.enterText(campo('Correo'), 'prueba@ejemplo.test');
      await _pulsar(tester);
      await tester.pump();
      expect(_boton(tester).estado, EstadoBoton.exito);
      await tester.pumpWidget(const SizedBox.shrink());
      await tester.pump(const Duration(seconds: 1));
      expect(tester.takeException(), isNull);
    },
  );
}
