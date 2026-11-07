import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:supera_paes/dominio/entidades/perfil_estudiante.dart';
import 'package:supera_paes/nucleo/constantes.dart';
import 'package:supera_paes/nucleo/errores.dart';
import 'package:supera_paes/nucleo/tema.dart';
import 'package:supera_paes/presentacion/comunes/animados.dart';
import 'package:supera_paes/presentacion/comunes/barra_inferior.dart';
import 'package:supera_paes/presentacion/comunes/boton_principal.dart';
import 'package:supera_paes/presentacion/comunes/componentes_seleccion.dart';
import 'package:supera_paes/presentacion/comunes/sello_prueba.dart';
import 'package:supera_paes/presentacion/enrutador.dart';
import 'package:supera_paes/presentacion/perfil_estudio/borrador_perfil.dart';
import 'package:supera_paes/presentacion/perfil_estudio/hoja_confirmar_curso.dart';
import 'package:supera_paes/presentacion/perfil_estudio/pantalla_paso_areas.dart';

import 'apoyo/app_de_prueba.dart';
import 'apoyo/repositorio_cuentas_falso.dart';
import 'apoyo/repositorio_perfil_falso.dart';

const _perfilDeMarzo = PerfilEstudiante(
  completo: true,
  curso: Curso(codigo: '3M', nombre: '3° medio'),
  anioEgreso: 2027,
  pruebas: [1, 2, 5],
  electivoId: 4,
  pruebaReforzarId: 2,
  areasCarrera: [1],
  debeConfirmarCurso: true,
);

class _PerfilPendiente extends RepositorioPerfilFalso {
  _PerfilPendiente({super.perfil = perfilVacio});

  Completer<void>? espera;
  ErrorApi? errorAlConfirmar;
  int solicitudesGuardar = 0;
  int solicitudesConfirmar = 0;

  @override
  Future<PerfilEstudiante> guardar(DatosPerfil datos) async {
    solicitudesGuardar++;
    if (espera case final pendiente?) await pendiente.future;
    return await super.guardar(datos);
  }

  @override
  Future<PerfilEstudiante> confirmarCurso(
    String curso, {
    int? anioEgreso,
  }) async {
    solicitudesConfirmar++;
    if (espera case final pendiente?) await pendiente.future;
    if (errorAlConfirmar case final error?) throw error;
    return await super.confirmarCurso(curso, anioEgreso: anioEgreso);
  }
}

Finder _chip(String texto) => find.widgetWithText(ChipTexto, texto);
Finder _tarjeta(String texto) => find.widgetWithText(TarjetaCasilla, texto);
Finder _reforzar(Prueba prueba) =>
    find.byWidgetPredicate((w) => w is ChipPrueba && w.prueba == prueba);

void _accesibilidad(WidgetTester tester, bool reducida, {double escala = 1}) {
  tester.platformDispatcher.accessibilityFeaturesTestValue =
      FakeAccessibilityFeatures(disableAnimations: reducida);
  tester.platformDispatcher.textScaleFactorTestValue = escala;
  addTearDown(tester.platformDispatcher.clearAccessibilityFeaturesTestValue);
  addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
}

Future<ProviderContainer> _abrir(
  WidgetTester tester, {
  RepositorioPerfilFalso? perfil,
}) async {
  final contenedor = crearContenedor(
    sesion: sesionDeEjemplo,
    perfil: perfil ?? RepositorioPerfilFalso(perfil: perfilVacio),
  );
  await iniciarApp(tester, contenedor);
  return contenedor;
}

Future<void> _areas(WidgetTester tester) async {
  await tocar(tester, find.text('3° medio'));
  await tocar(tester, find.text('Continuar'));
}

Future<void> _pruebas(WidgetTester tester) async {
  await _areas(tester);
  await tocar(tester, find.text('Omitir'));
}

Future<void> _pulsarSinEsperar(WidgetTester tester) async {
  await tester.pumpAndSettle();
  await tester.scrollUntilVisible(
    find.byType(BotonPrincipal),
    200,
    scrollable: find.byType(Scrollable).last,
  );
  await tester.ensureVisible(find.byType(BotonPrincipal));
  await tester.pumpAndSettle();
  await tester.tap(find.byType(BotonPrincipal));
  await tester.pump();
}

void main() {
  testWidgets('A08 selecciona el curso con vibración y conserva el borrador', (
    tester,
  ) async {
    final vibraciones = <Object?>[];
    tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
      SystemChannels.platform,
      (llamada) async {
        if (llamada.method == 'HapticFeedback.vibrate') {
          vibraciones.add(llamada.arguments);
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
    final contenedor = await _abrir(tester);
    expect(
      tester.widget<BotonPrincipal>(find.byType(BotonPrincipal)).onPressed,
      isNull,
    );
    expect(find.byType(BarraInferior), findsNothing);
    await tocar(tester, find.text('3° medio'));
    expect(vibraciones, contains('HapticFeedbackType.selectionClick'));
    expect(contenedor.read(borradorPerfilProvider).curso, '3M');
    await tocar(tester, find.text('Continuar'));
    expect(find.byType(BarraAnimada), findsNWidgets(3));
    contenedor.read(enrutadorProvider).pop();
    await tester.pumpAndSettle();
    expect(
      tester
          .widget<OpcionRadio>(find.widgetWithText(OpcionRadio, '3° medio'))
          .seleccionada,
      isTrue,
    );
    expect(find.byType(BarraInferior), findsNothing);
  });

  for (final reducida in [false, true]) {
    testWidgets('los pasos usan el eje horizontal; reducido=$reducida', (
      tester,
    ) async {
      _accesibilidad(tester, reducida);
      final contenedor = await _abrir(tester);
      await tocar(tester, find.text('3° medio'));
      await _pulsarSinEsperar(tester);
      await tester.pump(const Duration(milliseconds: 50));
      final transformacion = tester.widget<Transform>(
        find.ancestor(
          of: find.byType(PantallaPasoAreas),
          matching: find.byKey(const ValueKey('traslacion-pantalla')),
        ),
      );
      expect(
        transformacion.transform.storage[12],
        reducida ? isZero : greaterThan(0),
      );
      await tester.pumpAndSettle();
      expect(rutaActual(contenedor), Rutas.perfilAreas);
      expect(find.byType(BarraInferior), findsNothing);
      contenedor.read(enrutadorProvider).pop();
      await tester.pumpAndSettle();
      expect(rutaActual(contenedor), Rutas.perfilCurso);
    });

    testWidgets('A08b, A09b y A10 con letra 2,0; reducido=$reducida', (
      tester,
    ) async {
      _accesibilidad(tester, reducida, escala: 2);
      final perfil = RepositorioPerfilFalso(perfil: perfilVacio);
      final contenedor = await _abrir(tester, perfil: perfil);
      await tocar(tester, find.text('Ya egresé'));
      await tester.enterText(campo('Año en que egresaste de 4° medio'), '2025');
      await tocar(tester, find.text('Continuar'));
      for (final area in [
        'Salud',
        'Ciencias naturales',
        'Derecho y ciencia política',
        'Educación',
      ]) {
        await tocar(tester, _chip(area));
      }
      expect(contenedor.read(borradorPerfilProvider).areas, [1, 3, 6]);
      await tester.scrollUntilVisible(
        find.textContaining('Para elegir Educación, primero desmarca otra.'),
        200,
        scrollable: find.byType(Scrollable).first,
      );
      expect(find.textContaining('Puedes marcar hasta 3 áreas.'), findsOne);
      expect(tester.takeException(), isNull);
      await tocar(tester, find.text('Ver pruebas sugeridas'));
      await tocar(tester, _reforzar(Prueba.m1));
      expect(tester.takeException(), isNull);
      await tocar(tester, find.text('Guardar y empezar'));
      final datos = perfil.guardados.single;
      expect(datos.curso, 'EG');
      expect(datos.anioEgreso, 2025);
      expect(datos.pruebas, [1, 2, 3, 4, 5]);
      expect(datos.electivoId, 4);
      expect(datos.pruebaReforzarId, 2);
      expect(datos.areasCarrera, [1, 3, 6]);
      expect(rutaActual(contenedor), Rutas.inicio);
      expect(tester.takeException(), isNull);
    });

    testWidgets('A11 se desplaza y permite corregir con letra 2,0; '
        'reducido=$reducida', (tester) async {
      _accesibilidad(tester, reducida, escala: 2);
      final perfil = RepositorioPerfilFalso(perfil: _perfilDeMarzo);
      final contenedor = await _abrir(tester, perfil: perfil);
      expect(find.text('¿Sigues en 3° medio?'), findsOne);
      final contextoHoja = tester.element(find.byType(HojaConfirmarCurso));
      final ruta = ModalRoute.of(contextoHoja)! as ModalBottomSheetRoute<void>;
      expect(ruta.isDismissible, isFalse);
      expect(ruta.enableDrag, isFalse);
      await tester.ensureVisible(find.text('Corregir mi curso'));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
      await tester.tap(find.text('Corregir mi curso'));
      await tester.pumpAndSettle();
      expect(rutaActual(contenedor), Rutas.perfilCurso);
      expect(find.text('Paso 1 de 3'), findsNothing);
      await tocar(tester, find.text('4° medio'));
      await tocar(tester, find.text('Guardar mi curso'));
      expect(perfil.confirmaciones, [('4M', null)]);
      expect(perfil.guardados, isEmpty);
      expect(rutaActual(contenedor), Rutas.inicio);
      expect(tester.takeException(), isNull);
    });
  }

  testWidgets('A10 usa tonos y sellos; quitar una prueba limpia el refuerzo', (
    tester,
  ) async {
    final contenedor = await _abrir(tester);
    await _areas(tester);
    await tocar(tester, _chip('Salud'));
    await tocar(tester, find.text('Ver pruebas sugeridas'));
    for (final prueba in Prueba.values) {
      final nombre = opcionesDePrueba.pruebas
          .singleWhere((opcion) => opcion.codigo == prueba.codigo)
          .nombre;
      final tarjeta = _tarjeta(nombre);
      await tester.scrollUntilVisible(
        tarjeta,
        200,
        scrollable: find.byType(Scrollable).first,
      );
      expect(tester.widget<TarjetaCasilla>(tarjeta).prueba, prueba);
      expect(
        find.descendant(of: tarjeta, matching: find.byType(SelloPrueba)),
        findsOne,
      );
      final fondo =
          tester
                  .widget<AnimatedContainer>(
                    find
                        .descendant(
                          of: tarjeta,
                          matching: find.byType(AnimatedContainer),
                        )
                        .first,
                  )
                  .decoration!
              as BoxDecoration;
      final marcada = tester.widget<TarjetaCasilla>(tarjeta).marcada;
      expect(fondo.color, marcada ? prueba.fondo : TemaSuperaPaes.superficie);
    }
    await tocar(tester, _reforzar(Prueba.m1));
    expect(contenedor.read(borradorPerfilProvider).pruebaReforzarId, 2);
    await tester.scrollUntilVisible(
      _tarjeta('Competencia Matemática 1'),
      -200,
      scrollable: find.byType(Scrollable).first,
    );
    await tocar(tester, _tarjeta('Competencia Matemática 1'));
    expect(contenedor.read(borradorPerfilProvider).pruebaReforzarId, isNull);
    await tester.scrollUntilVisible(
      _chip('Ninguna'),
      200,
      scrollable: find.byType(Scrollable).first,
    );
    expect(_reforzar(Prueba.m1), findsNothing);
  });

  testWidgets('volver a A09 conserva las pruebas cambiadas en A10', (
    tester,
  ) async {
    final contenedor = await _abrir(tester);
    await _areas(tester);
    await tocar(tester, _chip('Salud'));
    await tocar(tester, find.text('Ver pruebas sugeridas'));
    await tocar(tester, _tarjeta('Competencia Matemática 2'));
    await tester.scrollUntilVisible(
      find.text('Áreas de carrera'),
      -200,
      scrollable: find.byType(Scrollable).first,
    );
    await tocar(tester, find.text('Áreas de carrera'));
    await tocar(tester, find.text('Ver pruebas sugeridas'));
    expect(contenedor.read(borradorPerfilProvider).pruebas, {1, 2, 3, 5});
    expect(rutaActual(contenedor), Rutas.perfilPruebas);
  });

  testWidgets('guardar lento bloquea duplicados y mantiene el botón cargando', (
    tester,
  ) async {
    final perfil = _PerfilPendiente()..espera = Completer<void>();
    final contenedor = await _abrir(tester, perfil: perfil);
    await _pruebas(tester);
    await tocar(tester, _tarjeta(Prueba.cl.nombre));
    await _pulsarSinEsperar(tester);
    expect(
      tester.widget<BotonPrincipal>(find.byType(BotonPrincipal)).estado,
      EstadoBoton.cargando,
    );
    await tester.tap(find.byType(BotonPrincipal));
    await tester.pump(const Duration(milliseconds: 200));
    expect(perfil.solicitudesGuardar, 1);
    perfil.espera!.complete();
    await tester.pumpAndSettle();
    expect(perfil.guardados.single.pruebas, [1]);
    expect(rutaActual(contenedor), Rutas.inicio);
    expect(tester.takeException(), isNull);
  });

  testWidgets('A11 muestra el error una vez y permite confirmar de nuevo', (
    tester,
  ) async {
    final perfil = _PerfilPendiente(perfil: _perfilDeMarzo)
      ..errorAlConfirmar = const ErrorApi(
        codigo: 'SIN_CONEXION',
        mensaje: 'No se pudo confirmar el curso.',
      );
    final contenedor = await _abrir(tester, perfil: perfil);
    await tester.tap(find.text('Sí, estoy en 3° medio'));
    await tester.pumpAndSettle();
    expect(find.text('No se pudo confirmar el curso.'), findsOne);
    expect(find.byType(HojaConfirmarCurso), findsOne);
    expect(
      tester.widget<BotonPrincipal>(find.byType(BotonPrincipal)).estado,
      EstadoBoton.error,
    );
    perfil.errorAlConfirmar = null;
    await tester.tap(find.text('Sí, estoy en 3° medio'));
    await tester.pumpAndSettle();
    expect(perfil.solicitudesConfirmar, 2);
    expect(perfil.confirmaciones, [('3M', null)]);
    expect(find.byType(HojaConfirmarCurso), findsNothing);
    expect(rutaActual(contenedor), Rutas.inicio);
  });

  testWidgets('A11 bloquea confirmar y corregir mientras guarda', (
    tester,
  ) async {
    final perfil = _PerfilPendiente(perfil: _perfilDeMarzo)
      ..espera = Completer<void>();
    await _abrir(tester, perfil: perfil);
    await tester.tap(find.text('Sí, estoy en 3° medio'));
    await tester.pump();
    await tester.tap(find.byType(BotonPrincipal));
    await tester.pump(const Duration(milliseconds: 200));
    expect(
      tester
          .widget<OutlinedButton>(
            find.widgetWithText(OutlinedButton, 'Corregir mi curso'),
          )
          .onPressed,
      isNull,
    );
    expect(perfil.solicitudesConfirmar, 1);
    perfil.espera!.complete();
    await tester.pumpAndSettle();
    expect(find.byType(HojaConfirmarCurso), findsNothing);
  });

  testWidgets('salir de A11 durante un error tardío no actualiza su estado', (
    tester,
  ) async {
    final perfil = _PerfilPendiente(perfil: _perfilDeMarzo)
      ..espera = Completer<void>()
      ..errorAlConfirmar = const ErrorApi(
        codigo: 'SIN_CONEXION',
        mensaje: 'No se pudo conectar.',
      );
    await _abrir(tester, perfil: perfil);
    await tester.tap(find.text('Sí, estoy en 3° medio'));
    await tester.pump();
    await tester.pumpWidget(const SizedBox.shrink());
    perfil.espera!.complete();
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
  });
}
