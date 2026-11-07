import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:supera_paes/nucleo/constantes.dart';
import 'package:supera_paes/nucleo/errores.dart';
import 'package:supera_paes/presentacion/apertura/pantalla_cargando.dart';
import 'package:supera_paes/presentacion/comunes/barra_inferior.dart';
import 'package:supera_paes/presentacion/comunes/boton_principal.dart';
import 'package:supera_paes/presentacion/comunes/componentes.dart';
import 'package:supera_paes/presentacion/comunes/componentes_seleccion.dart';
import 'package:supera_paes/presentacion/comunes/estado_cuenta.dart';
import 'package:supera_paes/presentacion/ingreso/pantalla_ingreso.dart';

import 'apoyo/app_de_prueba.dart';
import 'apoyo/repositorio_cuentas_falso.dart';
import 'apoyo/repositorio_perfil_falso.dart';

void _accesibilidad(WidgetTester tester, bool reducida) {
  tester.platformDispatcher.textScaleFactorTestValue = 2;
  tester.platformDispatcher.accessibilityFeaturesTestValue =
      FakeAccessibilityFeatures(disableAnimations: reducida);
  addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
  addTearDown(tester.platformDispatcher.clearAccessibilityFeaturesTestValue);
}

Future<void> _credenciales(WidgetTester tester, {bool registro = false}) async {
  if (registro) {
    await tester.enterText(campo('Nombre'), 'Estudiante de prueba');
  }
  await tester.enterText(campo('Correo'), 'prueba@ejemplo.test');
  await tester.enterText(campo('Contraseña'), 'dato de prueba');
  await tester.pumpAndSettle();
  if (registro) {
    await tocar(tester, find.byType(Checkbox));
    expect(tester.widget<Checkbox>(find.byType(Checkbox)).value, isTrue);
  }
}

Future<void> _pulsar(WidgetTester tester) async {
  final boton = find.descendant(
    of: find.byType(BotonPrincipal),
    matching: find.byType(FilledButton),
  );
  await tester.pumpAndSettle();
  await tester.scrollUntilVisible(
    boton,
    200,
    scrollable: find.byType(Scrollable).first,
  );
  await tester.ensureVisible(boton);
  await tester.pumpAndSettle();
  expect(boton.hitTestable(), findsOne);
  await tester.tap(boton);
  await tester.pump();
}

void main() {
  for (final reducida in [false, true]) {
    testWidgets('registro, perfil, cierre y nuevo ingreso con letra 2,0; '
        'reducido=$reducida', (tester) async {
      _accesibilidad(tester, reducida);
      final cuentas = RepositorioCuentasFalso();
      final almacen = AlmacenSesionEnMemoria();
      final perfil = RepositorioPerfilFalso(perfil: perfilVacio);
      final contenedor = crearContenedor(
        repositorio: cuentas,
        almacen: almacen,
        perfil: perfil,
      );
      await iniciarApp(tester, contenedor);
      await tocar(tester, find.text('Crea una'));
      expect(rutaActual(contenedor), Rutas.crearCuenta);
      await _credenciales(tester, registro: true);
      await _pulsar(tester);
      await tester.pumpAndSettle();
      expect(rutaActual(contenedor), Rutas.verificarCorreo);
      expect(cuentas.registros.single.documentosAceptados, [1, 2]);
      expect(almacen.guardada, same(sesionDeEjemplo));
      expect(find.byType(BarraInferior), findsNothing);
      await tocar(tester, find.widgetWithText(EnlaceVolver, 'Inicio'));
      expect(rutaActual(contenedor), Rutas.perfilCurso);
      expect(find.byType(BarraInferior), findsNothing);
      await tocar(tester, find.text('3° medio'));
      await tocar(tester, find.text('Continuar'));
      await tocar(tester, find.text('Omitir'));
      await tocar(
        tester,
        find.widgetWithText(TarjetaCasilla, 'Competencia Lectora'),
      );
      await tocar(tester, find.text('Guardar y empezar'));
      expect(perfil.guardados.single.pruebas, [1]);
      expect(rutaActual(contenedor), Rutas.inicio);
      expect(find.byType(BarraInferior), findsOne);
      expect(find.byType(PantallaCargando), findsNothing);
      await tester.tap(find.byKey(const ValueKey('pestana-4')).hitTestable());
      await tester.pumpAndSettle();
      await tocar(tester, find.text('Cerrar sesión'));
      expect(rutaActual(contenedor), Rutas.ingreso);
      expect(almacen.guardada, isNull);
      expect(find.text(PantallaIngreso.avisoSesionVencida), findsNothing);
      expect(find.byType(PantallaCargando), findsNothing);
      await _credenciales(tester);
      await _pulsar(tester);
      await tester.pumpAndSettle();
      expect(rutaActual(contenedor), Rutas.inicio);
      expect(cuentas.registros, hasLength(1));
      expect(cuentas.ingresos, hasLength(1));
      expect(perfil.guardados, hasLength(1));
      expect(find.byType(PantallaCargando), findsNothing);
      expect(tester.takeException(), isNull);
    });

    testWidgets('recuperación, reenvío y sesión vencida con letra 2,0; '
        'reducido=$reducida', (tester) async {
      _accesibilidad(tester, reducida);
      final cuentas = RepositorioCuentasFalso()
        ..errorAlRenovar = const ErrorApi(
          codigo: 'NO_AUTENTICADO',
          mensaje: 'La sesión venció.',
          estadoHttp: 401,
        );
      final almacen = AlmacenSesionEnMemoria();
      final contenedor = crearContenedor(
        repositorio: cuentas,
        almacen: almacen,
      );
      await iniciarApp(tester, contenedor);
      await tocar(tester, find.text('¿Olvidaste tu contraseña?'));
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
      expect(cuentas.recuperaciones, [
        'prueba@ejemplo.test',
        'prueba@ejemplo.test',
      ]);
      expect(almacen.guardada, isNull);
      await tester.scrollUntilVisible(
        find.widgetWithText(EnlaceVolver, 'Iniciar sesión'),
        -200,
        scrollable: find.byType(Scrollable).first,
      );
      await tocar(tester, find.widgetWithText(EnlaceVolver, 'Iniciar sesión'));
      await _credenciales(tester);
      await _pulsar(tester);
      await tester.pumpAndSettle();
      expect(rutaActual(contenedor), Rutas.inicio);
      expect(await contenedor.read(sesionProvider.notifier).renovar(), isFalse);
      await tester.pumpAndSettle();
      expect(rutaActual(contenedor), Rutas.ingreso);
      expect(find.text(PantallaIngreso.avisoSesionVencida), findsOne);
      expect(almacen.guardada, isNull);
      expect(find.byType(PantallaCargando), findsNothing);
      cuentas.errorAlIngresar = const ErrorApi(
        codigo: 'NO_AUTENTICADO',
        mensaje: 'El correo o la contraseña no son correctos.',
        estadoHttp: 401,
      );
      await _credenciales(tester);
      await _pulsar(tester);
      await tester.pumpAndSettle();
      expect(rutaActual(contenedor), Rutas.ingreso);
      expect(
        find.text('El correo o la contraseña no son correctos.'),
        findsOne,
      );
      await tester.scrollUntilVisible(
        find.text(PantallaIngreso.avisoSesionVencida),
        -200,
        scrollable: find.byType(Scrollable).first,
      );
      expect(find.text(PantallaIngreso.avisoSesionVencida), findsOne);
      cuentas.errorAlIngresar = null;
      await _pulsar(tester);
      await tester.pumpAndSettle();
      expect(rutaActual(contenedor), Rutas.inicio);
      expect(contenedor.read(avisoSesionVencidaProvider), isFalse);
      expect(almacen.guardada, same(sesionDeEjemplo));
      expect(tester.takeException(), isNull);
    });
  }

  for (final registro in [false, true]) {
    testWidgets('activar movimiento reducido durante el éxito '
        'completa la sesión; registro=$registro', (tester) async {
      final almacen = AlmacenSesionEnMemoria();
      final contenedor = crearContenedor(almacen: almacen);
      await iniciarApp(
        tester,
        contenedor,
        ruta: registro ? Rutas.crearCuenta : Rutas.ingreso,
      );
      await _credenciales(tester, registro: registro);
      await _pulsar(tester);
      await tester.pump();
      expect(
        tester.widget<BotonPrincipal>(find.byType(BotonPrincipal)).estado,
        EstadoBoton.exito,
      );
      expect(almacen.guardada, isNull);
      tester.platformDispatcher.accessibilityFeaturesTestValue =
          const FakeAccessibilityFeatures(disableAnimations: true);
      addTearDown(
        tester.platformDispatcher.clearAccessibilityFeaturesTestValue,
      );
      await tester.pump();
      await tester.pump();
      await tester.pump();
      expect(almacen.guardada, same(sesionDeEjemplo));
      await tester.pumpAndSettle();
      expect(
        rutaActual(contenedor),
        registro ? Rutas.verificarCorreo : Rutas.inicio,
      );
      expect(tester.takeException(), isNull);
    });
  }
}
