import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:supera_paes/datos/fuentes/fuente_evaluaciones_remota.dart';
import 'package:supera_paes/datos/modelos/resultado_modelo.dart';
import 'package:supera_paes/dominio/entidades/practica.dart';
import 'package:supera_paes/dominio/entidades/resultado_evaluacion.dart';
import 'package:supera_paes/nucleo/constantes.dart';
import 'package:supera_paes/nucleo/errores.dart';
import 'package:supera_paes/presentacion/practicar/estado_practica.dart';
import 'package:supera_paes/presentacion/resultado/estado_resultado.dart';
import 'package:supera_paes/presentacion/resultado/momento_resultado.dart';

import 'apoyo/adaptador_http_falso.dart';
import 'apoyo/app_de_prueba.dart';
import 'apoyo/repositorio_cuentas_falso.dart';
import 'apoyo/repositorio_evaluaciones_falso.dart';
import 'apoyo/repositorio_practica_falso.dart';
import 'apoyo/repositorio_resultados_falso.dart';

/// El diagnóstico de M1 de un estudiante de 1° medio: Geometría a reforzar
/// y Probabilidad omitida porque se enseña en 4° medio (A31).
const ResultadoEvaluacion _diagnostico = ResultadoEvaluacion(
  id: 78,
  tipo: 'diagnostico',
  tipoNombre: 'Diagnóstico',
  prueba: 'Matemática M1',
  pruebaId: 2,
  estado: 'entregada',
  cantidad: 15,
  puntuables: 15,
  correctas: 9,
  incorrectas: 5,
  omitidas: 1,
  porcentaje: 60,
  tiempoUsadoSeg: 21 * 60,
  duracionMin: 30,
  ejes: [
    GrupoDeResultado(id: 10, nombre: 'Números', preguntas: 5, correctas: 4),
    GrupoDeResultado(
      id: 12,
      nombre: 'Geometría',
      preguntas: 5,
      correctas: 2,
      aReforzar: true,
    ),
    GrupoDeResultado(
      id: 11,
      nombre: 'Álgebra y funciones',
      preguntas: 5,
      correctas: 3,
    ),
  ],
  habilidades: [],
  ejesOmitidos: [
    EjeOmitido(nombre: 'Probabilidad y estadística', curso: '4° medio'),
  ],
);

/// Abre A13 con el diagnóstico de M1 pendiente.
Future<
  (RepositorioEvaluacionesFalso, RepositorioPracticaFalso, ProviderContainer)
>
_abrirPractica(WidgetTester tester) async {
  final evaluaciones = RepositorioEvaluacionesFalso()
    ..diagnosticoDisponible = true;
  final practica = RepositorioPracticaFalso();
  final contenedor = crearContenedor(
    sesion: sesionDeEjemplo,
    evaluaciones: evaluaciones,
    practica: practica,
  );
  await iniciarApp(tester, contenedor, ruta: Rutas.practicar);
  return (evaluaciones, practica, contenedor);
}

void main() {
  group('Diagnóstico en la API', () {
    test('consulta sus cifras y lo empieza con POST a /diagnosticos', () async {
      final adaptador = AdaptadorHttpFalso(
        (opciones) => opciones.method == 'GET'
            ? respuestaOk({
                'pruebaId': 2,
                'cantidad': 15,
                'duracionMin': 30,
                'ejes': 3,
                'habilidades': 0,
                'anioEscolar': 2026,
                'disponible': true,
                'motivo': null,
              })
            : respuestaOk({
                'id': 78,
                'pruebaId': 2,
                'cantidad': 0,
                'duracionMin': 30,
                'venceEn': '2026-11-01T15:30:00.000Z',
                'preguntas': <Object>[],
              }, estado: 201),
      );
      final fuente = FuenteEvaluacionesRemota(
        Dio()..httpClientAdapter = adaptador,
      );

      final diagnostico = await fuente.disponibilidadDiagnostico(2);
      final evaluacion = await fuente.iniciarDiagnostico(2);

      expect(diagnostico.cantidad, 15);
      expect(diagnostico.duracionMin, 30);
      expect(diagnostico.ejes, 3);
      expect(adaptador.peticiones.last.path, '/evaluaciones/diagnosticos');
      expect(adaptador.peticiones.last.data, {'pruebaId': 2});
      expect(evaluacion.tipoNombre, 'Diagnóstico');
      expect(evaluacion.segundosRestantes, 30 * 60);
    });

    test('el resultado trae lo que se reforzará y los ejes omitidos', () {
      final resultado = ResultadoModelo.resultado({
        'id': 78,
        'tipo': {'codigo': 'diagnostico', 'nombre': 'Diagnóstico'},
        'prueba': {'id': 2, 'codigo': 'M1', 'nombre': 'Competencia M1'},
        'estado': {'codigo': 'entregada', 'nombre': 'Entregada'},
        'cantidad': 10,
        'puntuables': 10,
        'correctas': 6,
        'incorrectas': 4,
        'omitidas': 0,
        'porcentaje': 60,
        'tiempoUsadoSeg': 600,
        'duracionMin': 30,
        'puntaje': null,
        'tablaConversion': null,
        'recalculadoEn': null,
        'ejes': [
          {
            'id': 12,
            'nombre': 'Geometría',
            'preguntas': 5,
            'correctas': 2,
            'aReforzar': true,
          },
          {'id': 10, 'nombre': 'Números', 'preguntas': 5, 'correctas': 4},
        ],
        'habilidades': <Object>[],
        'ejesAReforzar': [12],
        'ejesOmitidos': [
          {'id': 13, 'nombre': 'Probabilidad', 'curso': '4° medio'},
        ],
      });

      expect(resultado.esDiagnostico, isTrue);
      expect(resultado.pruebaId, 2);
      expect(resultado.aReforzar.single.id, 12);
      expect(resultado.ejesOmitidos.single.curso, '4° medio');
    });
  });

  group('Ofrecer el diagnóstico (A16)', () {
    testWidgets('al empezar a practicar una prueba sin diagnóstico, lo '
        'ofrece', (tester) async {
      final (_, practica, contenedor) = await _abrirPractica(tester);

      await tocar(tester, find.text('Empezar práctica'));

      expect(rutaActual(contenedor), Rutas.ofrecerDiagnostico);
      expect(practica.iniciadas, isEmpty);
      expect(find.text('Antes de practicar M1'), findsOne);
      expect(find.text('15'), findsOne);
      expect(find.text('30'), findsOne);
      expect(find.text('de tu cupo'), findsOne);
      expect(
        find.text(
          'Solo de ejes que ya viste. Se rinde una vez por año escolar.',
        ),
        findsOne,
      );
    });

    testWidgets('«Ahora no, practicar igual» practica y no lo vuelve a '
        'ofrecer', (tester) async {
      final (_, practica, contenedor) = await _abrirPractica(tester);
      await tocar(tester, find.text('Empezar práctica'));

      await tester.tap(find.text('Ahora no, practicar igual'));
      await tester.pumpAndSettle();

      expect(practica.iniciadas, hasLength(1));
      expect(rutaActual(contenedor), Rutas.pregunta);

      await ir(tester, contenedor, Rutas.practicar);
      await tocar(tester, find.text('Empezar práctica'));
      expect(rutaActual(contenedor), Rutas.pregunta);
      expect(practica.iniciadas, hasLength(2));
    });

    testWidgets('«Rendir diagnóstico» lo empieza con reloj (A27)', (
      tester,
    ) async {
      final (evaluaciones, _, contenedor) = await _abrirPractica(tester);
      await tocar(tester, find.text('Empezar práctica'));

      await tester.tap(find.text('Rendir diagnóstico'));
      await tester.pumpAndSettle();

      expect(evaluaciones.diagnosticosIniciados, [2]);
      expect(rutaActual(contenedor), Rutas.preguntaConReloj);
      expect(find.text('Diagnóstico · M1'), findsOne);
    });

    testWidgets('si ya lo rindió, lo dice sobre el botón', (tester) async {
      final (evaluaciones, _, contenedor) = await _abrirPractica(tester);
      evaluaciones.erroresAlIniciar.add(
        const ErrorApi(
          codigo: 'DIAGNOSTICO_YA_RENDIDO',
          mensaje:
              'Ya rendiste el diagnóstico de esta prueba este año escolar.',
        ),
      );
      await tocar(tester, find.text('Empezar práctica'));

      await tester.tap(find.text('Rendir diagnóstico'));
      await tester.pumpAndSettle();

      expect(rutaActual(contenedor), Rutas.ofrecerDiagnostico);
      expect(
        find.text(
          'Ya rendiste el diagnóstico de esta prueba este año escolar.',
        ),
        findsOne,
      );
    });

    testWidgets('desde Evaluaciones (A25) se ofrece y «Ahora no» vuelve', (
      tester,
    ) async {
      final contenedor = crearContenedor(
        sesion: sesionDeEjemplo,
        evaluaciones: RepositorioEvaluacionesFalso()
          ..diagnosticoDisponible = true,
      );
      await iniciarApp(tester, contenedor, ruta: Rutas.evaluaciones);
      expect(
        find.text('15 preguntas · 30 min · solo con lo que ya viste'),
        findsOne,
      );

      await tocar(tester, find.text('Rendir diagnóstico'));
      expect(find.text('Diagnóstico de M1'), findsOne);

      await tester.tap(find.text('Ahora no'));
      await tester.pumpAndSettle();
      expect(rutaActual(contenedor), Rutas.evaluaciones);
    });
  });

  testWidgets('Inicio (A12) marca el diagnóstico pendiente y lo ofrece', (
    tester,
  ) async {
    final contenedor = crearContenedor(
      sesion: sesionDeEjemplo,
      evaluaciones: RepositorioEvaluacionesFalso()
        ..diagnosticoDisponible = true,
    );
    await iniciarApp(tester, contenedor, ruta: Rutas.inicio);

    await tester.scrollUntilVisible(
      find.text('Reforzar'),
      200,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.scrollUntilVisible(
      find.text('Diagnóstico pendiente este año').first,
      200,
      scrollable: find.byType(Scrollable).first,
    );
    expect(find.text('Diagnóstico pendiente este año'), findsWidgets);
    // M1 es la prueba a reforzar: sigue con «Reforzar»; Lectora, con
    // «Diagnóstico».
    expect(find.text('Reforzar'), findsOne);

    await tocar(tester, find.text('Diagnóstico').first);
    expect(rutaActual(contenedor), Rutas.ofrecerDiagnostico);
    expect(find.text('Diagnóstico de Lectora'), findsOne);
  });

  group('Resultado del diagnóstico (A31)', () {
    Future<ProviderContainer> abrirResultado(WidgetTester tester) async {
      final contenedor = crearContenedor(
        sesion: sesionDeEjemplo,
        resultados: RepositorioResultadosFalso(resultado: _diagnostico),
      );
      await iniciarApp(tester, contenedor);
      contenedor.read(evaluacionConsultadaProvider.notifier).evaluacion = 78;
      await ir(tester, contenedor, Rutas.resultado);
      return contenedor;
    }

    testWidgets('marca lo que se reforzará y avisa los ejes omitidos', (
      tester,
    ) async {
      await abrirResultado(tester);

      expect(find.text('Diagnóstico · Entregado'), findsOne);
      expect(
        find.descendant(
          of: find.byType(MomentoResultado),
          matching: find.text('60 %'),
        ),
        findsOne,
      );
      expect(find.text('A reforzar'), findsOne);
      expect(find.text('2 de 5 · 40 %'), findsOne);
      await tester.scrollUntilVisible(
        find.textContaining('prioridad a'),
        200,
        scrollable: find.byType(Scrollable).first,
      );
      expect(
        find.textContaining(
          'El eje Probabilidad y estadística se enseña en 4° medio',
        ),
        findsOne,
      );
      expect(
        find.textContaining(
          'Desde ahora tu práctica de Matemática M1 dará prioridad a '
          'Geometría.',
        ),
        findsOne,
      );
    });

    testWidgets('«Practicar Geometría» abre la práctica con ese eje', (
      tester,
    ) async {
      final contenedor = await abrirResultado(tester);

      await tester.tap(find.text('Practicar Geometría'));
      await tester.pumpAndSettle();

      expect(rutaActual(contenedor), Rutas.practicar);
      final borrador = contenedor.read(borradorPracticaProvider);
      expect(borrador.pruebaId, 2);
      expect(borrador.alcance.tipo, TipoAlcance.eje);
      expect(borrador.alcance.id, 12);
    });

    testWidgets('con la letra al doble, A16 y A31 no se desbordan', (
      tester,
    ) async {
      tester.platformDispatcher.textScaleFactorTestValue = 2;
      addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);

      await abrirResultado(tester);
      expect(tester.takeException(), isNull);

      final (_, _, _) = await _abrirPractica(tester);
      await tocar(tester, find.text('Empezar práctica'));
      expect(tester.takeException(), isNull);
    });
  });
}
