import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:supera_paes/dominio/entidades/sesion_estudiante.dart';
import 'package:supera_paes/nucleo/constantes.dart';
import 'package:supera_paes/nucleo/errores.dart';
import 'package:supera_paes/nucleo/tema.dart';
import 'package:supera_paes/presentacion/apertura/ambito_apertura.dart';
import 'package:supera_paes/presentacion/comunes/boton_principal.dart';
import 'package:supera_paes/presentacion/comunes/estado_cuenta.dart';
import 'package:supera_paes/presentacion/comunes/logo_acceso.dart';
import 'package:supera_paes/presentacion/ingreso/pantalla_ingreso.dart';

import 'apoyo/adaptador_http_falso.dart';
import 'apoyo/app_de_prueba.dart';
import 'apoyo/repositorio_cuentas_falso.dart';

const _vencida = ErrorApi(
  codigo: 'NO_AUTENTICADO',
  mensaje: 'La sesión venció.',
  estadoHttp: 401,
);
const _sinConexion = ErrorApi(
  codigo: 'SIN_CONEXION',
  mensaje: 'No se pudo conectar.',
);

class _CuentasPendientes extends RepositorioCuentasFalso {
  final respuesta = Completer<SesionEstudiante>();

  @override
  Future<SesionEstudiante> ingresar({
    required String correo,
    required String contrasena,
    String? dispositivo,
  }) {
    ingresos.add((
      correo: correo,
      contrasena: contrasena,
      dispositivo: dispositivo,
    ));
    return respuesta.future;
  }
}

Widget _marcoLogo({bool reducida = false, bool apertura = false}) =>
    Directionality(
      textDirection: TextDirection.ltr,
      child: MediaQuery(
        data: MediaQueryData(disableAnimations: reducida),
        child: AmbitoApertura(
          enCurso: apertura,
          child: const Center(child: LogoAcceso()),
        ),
      ),
    );

double _escalaLogo(WidgetTester tester) => tester
    .widget<ScaleTransition>(
      find.descendant(
        of: find.byType(LogoAcceso),
        matching: find.byType(ScaleTransition),
      ),
    )
    .scale
    .value;

BotonPrincipal _boton(WidgetTester tester) =>
    tester.widget<BotonPrincipal>(find.byType(BotonPrincipal));

Future<void> _enviar(WidgetTester tester) async {
  await tester.enterText(campo('Correo'), 'prueba@ejemplo.test');
  await tester.enterText(campo('Contraseña'), 'dato de prueba');
  await tester.ensureVisible(find.byType(BotonPrincipal));
  await tester.pumpAndSettle();
  await tester.tap(find.byType(BotonPrincipal));
  await tester.pump();
}

void main() {
  testWidgets('logo: escala de 0,96 a 1 sin cambiar su tamaño de diseño', (
    tester,
  ) async {
    await tester.pumpWidget(_marcoLogo());
    expect(_escalaLogo(tester), 0.96);
    final imagen = tester.widget<Image>(find.byType(Image));
    expect(imagen.width, TemaSuperaPaes.anchoLogoAcceso);
    expect(imagen.height, TemaSuperaPaes.altoLogoAcceso);
    await tester.pump(const Duration(milliseconds: 200));
    expect(_escalaLogo(tester), allOf(greaterThan(0.96), lessThan(1)));
    await tester.pumpAndSettle();
    expect(_escalaLogo(tester), 1);
  });

  testWidgets('el logo espera a que termine la apertura inicial', (
    tester,
  ) async {
    await tester.pumpWidget(_marcoLogo(apertura: true));
    await tester.pump(const Duration(seconds: 1));
    expect(_escalaLogo(tester), 0.96);
    expect(tester.binding.hasScheduledFrame, isFalse);
    await tester.pumpWidget(_marcoLogo());
    await tester.pumpAndSettle();
    expect(_escalaLogo(tester), 1);
  });

  testWidgets(
    'el logo queda completo en el primer cuadro con movimiento reducido',
    (tester) async {
      await tester.pumpWidget(_marcoLogo(reducida: true, apertura: true));
      expect(_escalaLogo(tester), 1);
      expect(tester.binding.hasScheduledFrame, isFalse);
    },
  );

  testWidgets(
    'activar movimiento reducido completa el logo y permite desmontar',
    (tester) async {
      await tester.pumpWidget(_marcoLogo());
      await tester.pump(const Duration(milliseconds: 100));
      await tester.pumpWidget(_marcoLogo(reducida: true));
      expect(_escalaLogo(tester), 1);
      await tester.pumpWidget(const SizedBox.shrink());
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    'ingreso lento bloquea duplicados y confirma éxito antes de entrar',
    (tester) async {
      final cuentas = _CuentasPendientes();
      final almacen = AlmacenSesionEnMemoria();
      final contenedor = crearContenedor(
        repositorio: cuentas,
        almacen: almacen,
      );
      await iniciarApp(tester, contenedor);
      await _enviar(tester);
      expect(_boton(tester).estado, EstadoBoton.cargando);
      for (final campo in tester.widgetList<TextField>(
        find.byType(TextField),
      )) {
        expect(campo.enabled, isFalse);
      }
      await tester.tap(find.byType(BotonPrincipal));
      await tester.pump(const Duration(milliseconds: 250));
      expect(cuentas.ingresos, hasLength(1));
      cuentas.respuesta.complete(sesionDeEjemplo);
      await tester.pump();
      await tester.pump();
      expect(_boton(tester).estado, EstadoBoton.exito);
      expect(almacen.guardada, isNull);
      await tester.pump(const Duration(milliseconds: 300));
      expect(_boton(tester).estado, EstadoBoton.exito);
      expect(almacen.guardada, isNull);
      await tester.pumpAndSettle();
      expect(almacen.guardada, same(sesionDeEjemplo));
      expect(rutaActual(contenedor), Rutas.inicio);
      expect(contenedor.read(avisoSesionVencidaProvider), isFalse);
    },
  );

  testWidgets(
    'credenciales incorrectas muestran un solo error y no indican vencimiento',
    (tester) async {
      final cuentas = RepositorioCuentasFalso()
        ..errorAlIngresar = const ErrorApi(
          codigo: 'NO_AUTENTICADO',
          mensaje: 'Correo o contraseña incorrectos.',
          estadoHttp: 401,
        );
      final contenedor = crearContenedor(repositorio: cuentas);
      await iniciarApp(tester, contenedor);
      await _enviar(tester);
      await tester.pumpAndSettle();
      expect(_boton(tester).estado, EstadoBoton.error);
      expect(_boton(tester).intentosFallidos, 1);
      expect(find.text('Correo o contraseña incorrectos.'), findsOne);
      expect(find.text(PantallaIngreso.avisoSesionVencida), findsNothing);
      await tester.tap(find.byType(BotonPrincipal));
      await tester.pumpAndSettle();
      expect(_boton(tester).intentosFallidos, 2);
      await tester.enterText(campo('Correo'), 'otro@ejemplo.test');
      await tester.pumpAndSettle();
      expect(_boton(tester).estado, EstadoBoton.normal);
      expect(find.text('Correo o contraseña incorrectos.'), findsNothing);
    },
  );

  testWidgets(
    '401 de una petición protegida muestra el aviso al fallar la renovación',
    (tester) async {
      final cuentas = RepositorioCuentasFalso()..errorAlRenovar = _vencida;
      final almacen = AlmacenSesionEnMemoria(sesionDeEjemplo);
      final contenedor = crearContenedor(
        repositorio: cuentas,
        almacen: almacen,
      );
      await iniciarApp(tester, contenedor, ruta: Rutas.perfil);
      final dio = contenedor.read(clienteHttpConSesionProvider)
        ..httpClientAdapter = AdaptadorHttpFalso(
          (_) => (
            401,
            {
              'data': null,
              'error': {
                'codigo': 'NO_AUTENTICADO',
                'mensaje': 'Sesión vencida.',
              },
              'meta': null,
            },
          ),
        );
      await tester.runAsync(
        () => expectLater(
          dio.get<Object?>('/protegida'),
          throwsA(isA<DioException>()),
        ),
      );
      await tester.pumpAndSettle();
      expect(rutaActual(contenedor), Rutas.ingreso);
      expect(almacen.guardada, isNull);
      expect(find.text(PantallaIngreso.avisoSesionVencida), findsOne);
      expect(
        tester
            .widgetList<Semantics>(
              find.ancestor(
                of: find.text(PantallaIngreso.avisoSesionVencida),
                matching: find.byType(Semantics),
              ),
            )
            .any((s) => s.properties.liveRegion == true),
        isTrue,
      );
      expect(cuentas.renovaciones, hasLength(1));
      await _enviar(tester);
      await tester.pumpAndSettle();
      expect(rutaActual(contenedor), Rutas.inicio);
      expect(contenedor.read(avisoSesionVencidaProvider), isFalse);
      await contenedor.read(sesionProvider.notifier).cerrar();
      await tester.pumpAndSettle();
      expect(find.text(PantallaIngreso.avisoSesionVencida), findsNothing);
    },
  );

  for (final error in [null, _sinConexion]) {
    testWidgets(
      'cerrar sesión voluntariamente no muestra aviso; error=$error',
      (tester) async {
        final cuentas = RepositorioCuentasFalso()..errorAlCerrar = error;
        final contenedor = crearContenedor(
          sesion: sesionDeEjemplo,
          repositorio: cuentas,
        );
        await iniciarApp(tester, contenedor, ruta: Rutas.perfil);
        await contenedor.read(sesionProvider.notifier).cerrar();
        await tester.pumpAndSettle();
        expect(rutaActual(contenedor), Rutas.ingreso);
        expect(find.text(PantallaIngreso.avisoSesionVencida), findsNothing);
      },
    );
  }

  testWidgets(
    'sin conexión al renovar conserva la sesión y no marca vencimiento',
    (tester) async {
      final cuentas = RepositorioCuentasFalso()..errorAlRenovar = _sinConexion;
      final contenedor = crearContenedor(
        sesion: sesionDeEjemplo,
        repositorio: cuentas,
      );
      await iniciarApp(tester, contenedor, ruta: Rutas.perfil);
      expect(await contenedor.read(sesionProvider.notifier).renovar(), isFalse);
      await tester.pumpAndSettle();
      expect(contenedor.read(avisoSesionVencidaProvider), isFalse);
      expect(contenedor.read(sesionProvider).value, isNotNull);
      expect(rutaActual(contenedor), Rutas.perfil);
    },
  );

  for (final reducida in [false, true]) {
    testWidgets(
      'aviso y errores sin desborde con letra 2,0; reducido=$reducida',
      (tester) async {
        tester.platformDispatcher.textScaleFactorTestValue = 2;
        tester.platformDispatcher.accessibilityFeaturesTestValue =
            FakeAccessibilityFeatures(disableAnimations: reducida);
        addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
        addTearDown(
          tester.platformDispatcher.clearAccessibilityFeaturesTestValue,
        );
        final cuentas = RepositorioCuentasFalso()..errorAlRenovar = _vencida;
        final contenedor = crearContenedor(
          sesion: sesionDeEjemplo,
          repositorio: cuentas,
        );
        await iniciarApp(tester, contenedor);
        await contenedor.read(sesionProvider.notifier).renovar();
        await tester.pumpAndSettle();
        expect(find.text(PantallaIngreso.avisoSesionVencida), findsOne);
        await tocar(tester, find.byType(BotonPrincipal));
        expect(find.text('Ingresa tu contraseña.'), findsOne);
        expect(_boton(tester).estado, EstadoBoton.error);
        expect(tester.takeException(), isNull);
      },
    );
  }

  testWidgets('con movimiento reducido confirma y entra sin esperar 600 ms', (
    tester,
  ) async {
    tester.platformDispatcher.accessibilityFeaturesTestValue =
        const FakeAccessibilityFeatures(disableAnimations: true);
    addTearDown(tester.platformDispatcher.clearAccessibilityFeaturesTestValue);
    final contenedor = crearContenedor();
    await iniciarApp(tester, contenedor);
    await _enviar(tester);
    await tester.pump();
    await tester.pump();
    await tester.pump();
    expect(rutaActual(contenedor), Rutas.inicio);
    await tester.pumpAndSettle();
  });

  testWidgets(
    'desmontar durante la confirmación no deja temporizadores ni sesión',
    (tester) async {
      final almacen = AlmacenSesionEnMemoria();
      final contenedor = crearContenedor(almacen: almacen);
      await iniciarApp(tester, contenedor);
      await _enviar(tester);
      await tester.pump();
      expect(_boton(tester).estado, EstadoBoton.exito);
      await tester.pumpWidget(const SizedBox.shrink());
      await tester.pump(const Duration(seconds: 1));
      expect(almacen.guardada, isNull);
      expect(tester.takeException(), isNull);
    },
  );
}
