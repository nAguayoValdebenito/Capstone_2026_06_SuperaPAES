import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:supera_paes/nucleo/constantes.dart';
import 'package:supera_paes/nucleo/tema.dart';
import 'package:supera_paes/presentacion/comunes/barra_inferior.dart';
import 'package:supera_paes/presentacion/comunes/hoja_confirmacion.dart';
import 'package:supera_paes/presentacion/comunes/rutas_navegacion.dart';
import 'package:supera_paes/presentacion/comunes/secciones.dart';
import 'package:supera_paes/presentacion/enrutador.dart';

import 'apoyo/app_de_prueba.dart';
import 'apoyo/repositorio_cuentas_falso.dart';
import 'apoyo/repositorio_perfil_falso.dart';

void _movimiento(WidgetTester tester, bool reducido) {
  tester.platformDispatcher.accessibilityFeaturesTestValue =
      FakeAccessibilityFeatures(disableAnimations: reducido);
  addTearDown(tester.platformDispatcher.clearAccessibilityFeaturesTestValue);
}

Future<void> _pestana(WidgetTester tester, int indice) async {
  await tester.tap(find.byKey(ValueKey('pestana-$indice')).hitTestable());
  await tester.pumpAndSettle();
}

void main() {
  test('toda pantalla tiene una dueña o está declarada sin barra', () {
    for (final seccion in secciones) {
      expect(
        (seccion.rutaPestana != null) != rutasSinBarra.contains(seccion.ruta),
        isTrue,
        reason: seccion.ruta,
      );
    }
    expect(
      rutasSinBarra,
      containsAll([
        Rutas.cargando,
        Rutas.ingreso,
        Rutas.crearCuenta,
        Rutas.recuperarContrasena,
        Rutas.perfilCurso,
        Rutas.perfilAreas,
        Rutas.perfilPruebas,
        Rutas.pregunta,
        Rutas.correccion,
        Rutas.preguntaConReloj,
        Rutas.verTodas,
      ]),
    );
    expect(rutasPublicas, containsAll([Rutas.terminos, Rutas.privacidad]));
  });

  testWidgets('cada subruta conserva su dirección y su pestaña marcada', (
    tester,
  ) async {
    final contenedor = crearContenedor(sesion: sesionDeEjemplo);
    await iniciarApp(tester, contenedor);
    for (final seccion in secciones.where((s) => s.rutaPestana != null)) {
      await ir(tester, contenedor, seccion.ruta);
      expect(rutaActual(contenedor), seccion.ruta);
      expect(
        tester.widget<BarraInferior>(find.byType(BarraInferior)).seleccionada,
        pestanas.indexWhere((p) => p.ruta == seccion.rutaPestana),
        reason: seccion.ruta,
      );
    }
  });

  testWidgets('acceso y documentos públicos sin sesión no muestran la barra', (
    tester,
  ) async {
    final contenedor = crearContenedor();
    await iniciarApp(tester, contenedor);
    for (final ruta in rutasPublicas) {
      await ir(tester, contenedor, ruta);
      expect(rutaActual(contenedor), ruta);
      expect(find.byType(BarraInferior), findsNothing);
      expect(find.byType(NavigationBar), findsNothing);
    }
    await ir(tester, contenedor, '/evaluaciones/planes');
    expect(rutaActual(contenedor), Rutas.ingreso);
  });

  testWidgets('concentración y perfil inicial se abren sin barra', (
    tester,
  ) async {
    final contenedor = crearContenedor(sesion: sesionDeEjemplo);
    await iniciarApp(tester, contenedor);
    for (final ruta in rutasSinBarra.difference({
      Rutas.cargando,
      Rutas.ingreso,
    })) {
      await ir(tester, contenedor, ruta);
      expect(rutaActual(contenedor), ruta);
      expect(find.byType(BarraInferior).hitTestable(), findsNothing);
    }
  });

  testWidgets(
    'el perfil incompleto conserva sus restricciones y el acceso legal',
    (tester) async {
      final contenedor = crearContenedor(
        sesion: sesionDeEjemplo,
        perfil: RepositorioPerfilFalso(perfil: perfilVacio),
      );
      await iniciarApp(tester, contenedor);
      for (final ruta in [
        Rutas.perfil,
        Rutas.planes,
        Rutas.historial,
        '/inicio/planes',
      ]) {
        await ir(tester, contenedor, ruta);
        expect(rutaActual(contenedor), Rutas.perfilCurso);
        expect(find.byType(BarraInferior), findsNothing);
      }
      for (final ruta in [Rutas.terminos, Rutas.privacidad]) {
        await ir(tester, contenedor, ruta);
        expect(rutaActual(contenedor), ruta);
        expect(find.byType(BarraInferior), findsNothing);
      }
    },
  );

  testWidgets('las hojas cubren la barra usando el navegador raíz', (
    tester,
  ) async {
    final contenedor = crearContenedor(sesion: sesionDeEjemplo);
    await iniciarApp(tester, contenedor, ruta: Rutas.perfil);
    final contexto = tester.element(find.text('Mi perfil de estudio'));
    final raiz = Navigator.of(contexto, rootNavigator: true);
    expect(Navigator.of(contexto), isNot(same(raiz)));
    unawaited(
      mostrarHoja<void>(
        contexto,
        const HojaConfirmacion(
          titulo: 'Confirmación de prueba',
          contenido: Text('Una decisión local.'),
          confirmar: 'Confirmar',
          cancelar: 'Volver',
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(
      Navigator.of(tester.element(find.byType(HojaConfirmacion))),
      same(raiz),
    );
    expect(find.byType(BarraInferior).hitTestable(), findsNothing);
    await tester.tap(find.text('Volver').last);
    await tester.pumpAndSettle();
    expect(find.byType(BarraInferior).hitTestable(), findsOne);
  });

  for (final reducido in [false, true]) {
    testWidgets('Perfil → Planes → Inicio → Perfil conserva pila y selección; '
        'reducido=$reducido', (tester) async {
      _movimiento(tester, reducido);
      final contenedor = crearContenedor(sesion: sesionDeEjemplo);
      await iniciarApp(tester, contenedor, ruta: Rutas.perfil);
      unawaited(contenedor.read(enrutadorProvider).push<void>(Rutas.planes));
      await tester.pumpAndSettle();
      await tocar(tester, find.text('Mensual'));
      await _pestana(tester, 0);
      expect(rutaActual(contenedor), Rutas.inicio);
      await _pestana(tester, 4);
      expect(rutaActual(contenedor), Rutas.planes);
      expect(find.text(r'$1.990 /mes'), findsOne);
      await _pestana(tester, 4);
      expect(rutaActual(contenedor), Rutas.perfil);
      expect(find.text(r'$1.990 /mes'), findsNothing);
    });

    testWidgets(
      'Planes desde Cupo conserva Inicio y vuelve a Cupo; reducido=$reducido',
      (tester) async {
        _movimiento(tester, reducido);
        final contenedor = crearContenedor(sesion: sesionDeEjemplo);
        await iniciarApp(tester, contenedor, ruta: Rutas.cupoAgotado);
        await tocar(tester, find.text('Suscríbete'));
        expect(rutaActual(contenedor), rutaPlanesEnRama(Rutas.inicio));
        expect(
          tester.widget<BarraInferior>(find.byType(BarraInferior)).seleccionada,
          0,
        );
        await tester.binding.handlePopRoute();
        await tester.pumpAndSettle();
        expect(rutaActual(contenedor), Rutas.cupoAgotado);
      },
    );

    testWidgets(
      'Planes desde Evaluaciones conserva la pestaña; reducido=$reducido',
      (tester) async {
        _movimiento(tester, reducido);
        final contenedor = crearContenedor(sesion: sesionDeEjemplo);
        await iniciarApp(tester, contenedor, ruta: Rutas.evaluaciones);
        await tester.scrollUntilVisible(
          find.text('Ver planes'),
          150,
          scrollable: find.byType(Scrollable).first,
        );
        await tocar(tester, find.text('Ver planes').first);
        expect(rutaActual(contenedor), rutaPlanesEnRama(Rutas.evaluaciones));
        expect(
          tester.widget<BarraInferior>(find.byType(BarraInferior)).seleccionada,
          2,
        );
        await _pestana(tester, 2);
        expect(rutaActual(contenedor), Rutas.evaluaciones);
      },
    );

    testWidgets(
      'Practicar → pregunta → resumen mantiene el modo de concentración; '
      'reducido=$reducido',
      (tester) async {
        _movimiento(tester, reducido);
        final contenedor = crearContenedor(sesion: sesionDeEjemplo);
        await iniciarApp(tester, contenedor, ruta: Rutas.practicar);
        await tocar(tester, find.text('Empezar práctica'));
        expect(rutaActual(contenedor), Rutas.pregunta);
        expect(find.byType(BarraInferior).hitTestable(), findsNothing);
        await tocar(tester, find.text('Terminar'));
        await tocar(tester, find.text('Terminar').last);
        expect(rutaActual(contenedor), Rutas.resumenPractica);
        expect(
          tester.widget<BarraInferior>(find.byType(BarraInferior)).seleccionada,
          1,
        );
      },
    );

    testWidgets('iPhone conserva el gesto desde el borde; reducido=$reducido', (
      tester,
    ) async {
      debugDefaultTargetPlatformOverride = TargetPlatform.iOS;
      try {
        _movimiento(tester, reducido);
        final contenedor = crearContenedor(sesion: sesionDeEjemplo);
        await iniciarApp(tester, contenedor, ruta: Rutas.perfil);
        unawaited(contenedor.read(enrutadorProvider).push<void>(Rutas.planes));
        await tester.pumpAndSettle();
        await tester.dragFrom(const Offset(1, 220), const Offset(360, 0));
        await tester.pumpAndSettle();
        expect(rutaActual(contenedor), Rutas.perfil);
      } finally {
        debugDefaultTargetPlatformOverride = null;
      }
    });
  }

  testWidgets('tablet mantiene NavigationBar y la selección de la subruta', (
    tester,
  ) async {
    final contenedor = crearContenedor(sesion: sesionDeEjemplo);
    await iniciarApp(tester, contenedor, ruta: Rutas.puntajes);
    tester.view.physicalSize = const Size(768, 1024);
    await tester.pumpAndSettle();
    expect(find.byType(BarraInferior), findsNothing);
    expect(
      tester.widget<NavigationBar>(find.byType(NavigationBar)).selectedIndex,
      4,
    );
    expect(
      TemaSuperaPaes.claro.navigationBarTheme.height,
      TemaSuperaPaes.altoBarraNavegacion,
    );
  });

  for (final reducido in [false, true]) {
    testWidgets(
      'la página usa 400/280 ms o fundido de 150 ms; reducido=$reducido',
      (tester) async {
        _movimiento(tester, reducido);
        final contenedor = crearContenedor(sesion: sesionDeEjemplo);
        await iniciarApp(tester, contenedor, ruta: Rutas.perfil);
        unawaited(contenedor.read(enrutadorProvider).push<void>(Rutas.planes));
        await tester.pump();
        await tester.pump();
        final contexto = tester.element(find.text('Planes'));
        final ruta = ModalRoute.of(contexto)! as PageRoute<void>;
        expect(
          ruta.transitionDuration,
          Duration(milliseconds: reducido ? 150 : 400),
        );
        expect(
          ruta.reverseTransitionDuration,
          Duration(milliseconds: reducido ? 150 : 280),
        );
        final transformacion = find
            .ancestor(
              of: find.text('Planes'),
              matching: find.byKey(const ValueKey('traslacion-pantalla')),
            )
            .first;
        final inicial = tester
            .widget<Transform>(transformacion)
            .transform
            .storage[12];
        expect(inicial, reducido ? 0 : TemaSuperaPaes.desplazamientoPantalla);
        await tester.pumpAndSettle();
        expect(
          tester.widget<Transform>(transformacion).transform.storage[12],
          0,
        );
      },
    );
  }
}
