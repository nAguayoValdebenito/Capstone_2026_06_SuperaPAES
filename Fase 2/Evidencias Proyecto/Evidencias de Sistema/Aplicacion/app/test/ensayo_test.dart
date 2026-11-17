import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:supera_paes/datos/fuentes/fuente_evaluaciones_remota.dart';
import 'package:supera_paes/nucleo/constantes.dart';
import 'package:supera_paes/nucleo/errores.dart';
import 'package:supera_paes/presentacion/comunes/rutas_navegacion.dart';

import 'apoyo/adaptador_http_falso.dart';
import 'apoyo/app_de_prueba.dart';
import 'apoyo/repositorio_cuentas_falso.dart';
import 'apoyo/repositorio_evaluaciones_falso.dart';

/// Abre A25 con el perfil de ejemplo (M1 a reforzar).
Future<(RepositorioEvaluacionesFalso, ProviderContainer)> _abrirEvaluaciones(
  WidgetTester tester, {
  String? motivo,
}) async {
  final repo = RepositorioEvaluacionesFalso()..motivoEnsayo = motivo;
  final contenedor = crearContenedor(
    sesion: sesionDeEjemplo,
    evaluaciones: repo,
  );
  await iniciarApp(tester, contenedor, ruta: Rutas.evaluaciones);
  await tester.scrollUntilVisible(
    find.text('Ensayo completo'),
    200,
    scrollable: find.byType(Scrollable).first,
  );
  return (repo, contenedor);
}

const String _detalle =
    '65 preguntas (5 no puntúan) · 2 h 20 min · puntaje estimado de 100 a '
    '1.000';

void main() {
  test('consulta la disponibilidad del ensayo y lo empieza con POST a '
      '/ensayos', () async {
    final adaptador = AdaptadorHttpFalso(
      (opciones) => opciones.method == 'GET'
          ? respuestaOk({
              'pruebaId': 1,
              'cantidad': 65,
              'duracionMin': 150,
              'textos': 7,
              'sinPuntaje': 5,
              'disponible': false,
              'motivo': 'plan_todas_requerido',
            })
          : respuestaOk({
              'id': 79,
              'pruebaId': 1,
              'cantidad': 0,
              'duracionMin': 150,
              'venceEn': '2026-11-01T17:30:00.000Z',
              'preguntas': <Object>[],
            }, estado: 201),
    );
    final fuente = FuenteEvaluacionesRemota(
      Dio()..httpClientAdapter = adaptador,
    );

    final ensayo = await fuente.disponibilidadEnsayo(1);
    final evaluacion = await fuente.iniciarEnsayo(1);

    expect(
      adaptador.peticiones.first.path,
      '/evaluaciones/ensayos/disponibilidad',
    );
    expect(ensayo.textos, 7);
    expect(ensayo.sinPuntaje, 5);
    expect(ensayo.faltaElPlan, isTrue);
    expect(adaptador.peticiones.last.path, '/evaluaciones/ensayos');
    expect(adaptador.peticiones.last.data, {'pruebaId': 1});
    expect(evaluacion.tipoNombre, 'Ensayo completo');
    expect(evaluacion.segundosRestantes, 150 * 60);
  });

  group('Ensayo completo en A25', () {
    testWidgets('sin el plan Todas las pruebas, sus cifras y «Ver planes»', (
      tester,
    ) async {
      final (_, contenedor) = await _abrirEvaluaciones(
        tester,
        motivo: 'plan_todas_requerido',
      );

      expect(find.text('Todas las pruebas'), findsOne);
      expect(find.text(_detalle), findsOne);
      expect(find.text('Rendir ensayo completo'), findsNothing);

      await tocar(tester, find.text('Ver planes').last);
      expect(rutaActual(contenedor), rutaPlanesEnRama(Rutas.evaluaciones));
    });

    testWidgets('en Ciencias sin electivo, lleva a elegirlo', (tester) async {
      final (_, contenedor) = await _abrirEvaluaciones(
        tester,
        motivo: 'electivo_requerido',
      );

      expect(find.text('Incluido en tu plan'), findsOne);
      await tocar(tester, find.text('Elegir electivo'));
      expect(rutaActual(contenedor), Rutas.perfilPruebas);
    });

    testWidgets('con el plan, explica las condiciones y lo empieza con reloj', (
      tester,
    ) async {
      final (repo, contenedor) = await _abrirEvaluaciones(tester);
      expect(find.text('Incluido en tu plan'), findsOne);

      await tocar(tester, find.text('Rendir ensayo completo'));
      expect(rutaActual(contenedor), Rutas.antesDelEnsayo);
      expect(find.text('Matemática M1'), findsOne);
      expect(find.text('65'), findsOne);
      expect(find.text('140'), findsOne);
      expect(find.text('no puntúan'), findsOne);
      expect(find.textContaining('El reloj sigue corriendo'), findsOne);
      expect(
        find.text(
          '5 preguntas no puntúan, como en la PAES. Sabrás cuáles al revisar.',
        ),
        findsOne,
      );
      await tester.scrollUntilVisible(
        find.textContaining('puntaje estimado de 100 a 1.000'),
        200,
        scrollable: find.byType(Scrollable).first,
      );
      expect(find.textContaining('puntaje estimado de 100 a 1.000'), findsOne);
      await tester.scrollUntilVisible(
        find.text('Está incluido en tu plan Todas las pruebas.'),
        200,
        scrollable: find.byType(Scrollable).first,
      );

      await tester.tap(find.text('Empezar ahora'));
      await tester.pumpAndSettle();

      expect(repo.ensayosIniciados, [2]);
      expect(rutaActual(contenedor), Rutas.preguntaConReloj);
      expect(find.text('Ensayo completo · M1'), findsOne);
    });

    testWidgets('si el servidor lo rechaza, muestra el motivo', (tester) async {
      final (repo, contenedor) = await _abrirEvaluaciones(tester);
      repo.erroresAlIniciar.add(
        const ErrorApi(
          codigo: 'SIN_PERMISO',
          mensaje: 'El ensayo completo requiere el plan Todas las pruebas.',
        ),
      );
      await tocar(tester, find.text('Rendir ensayo completo'));

      await tester.tap(find.text('Empezar ahora'));
      await tester.pumpAndSettle();

      expect(rutaActual(contenedor), Rutas.antesDelEnsayo);
      expect(
        find.text('El ensayo completo requiere el plan Todas las pruebas.'),
        findsOne,
      );
    });

    testWidgets('con la letra al doble, A25 y su «Antes de empezar» no se '
        'desbordan', (tester) async {
      tester.platformDispatcher.textScaleFactorTestValue = 2;
      addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);

      await _abrirEvaluaciones(tester);
      expect(tester.takeException(), isNull);
      await tocar(tester, find.text('Rendir ensayo completo'));
      expect(tester.takeException(), isNull);
    });
  });
}
