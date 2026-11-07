import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:supera_paes/datos/fuentes/fuente_evaluaciones_remota.dart';
import 'package:supera_paes/datos/modelos/practica_modelo.dart';
import 'package:supera_paes/dominio/entidades/evaluacion_abierta.dart';
import 'package:supera_paes/dominio/entidades/evaluacion_con_tiempo.dart';
import 'package:supera_paes/dominio/entidades/practica.dart';
import 'package:supera_paes/nucleo/constantes.dart';
import 'package:supera_paes/nucleo/errores.dart';
import 'package:supera_paes/presentacion/comunes/rutas_navegacion.dart';
import 'package:supera_paes/presentacion/evaluaciones/estado_evaluaciones.dart';
import 'package:supera_paes/presentacion/evaluaciones/tarjetas_evaluaciones.dart';
import 'package:supera_paes/presentacion/resultado/estado_resultado.dart';

import 'apoyo/adaptador_http_falso.dart';
import 'apoyo/app_de_prueba.dart';
import 'apoyo/repositorio_cuentas_falso.dart';
import 'apoyo/repositorio_evaluaciones_falso.dart';
import 'apoyo/repositorio_practica_falso.dart';

/// El mini-ensayo de M1 sin terminar, con la primera respondida (la B) y
/// 18:05 por delante (A29).
EvaluacionAbierta _miniAbierto() => EvaluacionAbierta(
  id: 42,
  tipo: 'mini_ensayo',
  tipoNombre: 'Mini-ensayo',
  pruebaId: 2,
  prueba: 'Matemática M1',
  alcance: Alcance.todaLaPrueba,
  dificultadId: null,
  cantidad: 3,
  respondidas: 1,
  segundosRestantes: 18 * 60 + 5,
  preguntas: [
    preguntaConTiempo(1, elegidaId: 11),
    preguntaConTiempo(2),
    preguntaConTiempo(3),
  ],
);

/// Abre A25 con el perfil de ejemplo (M1 a reforzar).
Future<(RepositorioEvaluacionesFalso, ProviderContainer)> _abrirEvaluaciones(
  WidgetTester tester, {
  RepositorioEvaluacionesFalso? evaluaciones,
  RepositorioPracticaFalso? practica,
}) async {
  final repo = evaluaciones ?? RepositorioEvaluacionesFalso();
  final contenedor = crearContenedor(
    sesion: sesionDeEjemplo,
    evaluaciones: repo,
    practica: practica,
  );
  await iniciarApp(tester, contenedor, ruta: Rutas.evaluaciones);
  return (repo, contenedor);
}

/// De A25 a la primera pregunta (A27).
Future<void> _empezar(WidgetTester tester) async {
  await tocar(tester, find.text('Rendir mini-ensayo'));
  await tester.tap(find.text('Empezar ahora'));
  await tester.pumpAndSettle();
}

void main() {
  group('Evaluaciones con tiempo en la API', () {
    test('consulta la disponibilidad, empieza, guarda y entrega', () async {
      final adaptador = AdaptadorHttpFalso(
        (opciones) => switch (opciones.path) {
          '/evaluaciones/mini-ensayos/disponibilidad' => respuestaOk({
            'pruebaId': 2,
            'cantidad': 22,
            'duracionMin': 48,
            'ejes': 4,
            'habilidades': 0,
            'conPlan': false,
            'gratisRestantes': 1,
            'disponible': true,
            'motivo': null,
          }),
          '/evaluaciones/mini-ensayos' => respuestaOk({
            'id': 77,
            'pruebaId': 2,
            'cantidad': 2,
            'duracionMin': 48,
            'venceEn': '2026-10-31T23:48:00.000Z',
            'preguntas': [
              for (final orden in [2, 1])
                {
                  'id': 900 + orden,
                  'orden': orden,
                  'enunciado': 'Pregunta $orden',
                  'texto': null,
                  'alternativas': [
                    {'id': 2, 'letra': 'B', 'texto': 'dos'},
                    {'id': 1, 'letra': 'A', 'texto': 'uno'},
                  ],
                  'alternativaElegidaId': null,
                  'respondidaEn': null,
                },
            ],
          }),
          '/evaluaciones/77/items/901/respuesta' => respuestaOk({
            'alternativaElegidaId': 1,
            'respondidaEn': '2026-10-31T23:01:00.000Z',
          }),
          _ => respuestaOk({
            'id': 77,
            'estado': 'entregada',
            'resultadoDisponible': true,
          }),
        },
      );
      final fuente = FuenteEvaluacionesRemota(
        Dio()..httpClientAdapter = adaptador,
      );

      final mini = await fuente.disponibilidadMiniEnsayo(2);
      final evaluacion = await fuente.iniciarMiniEnsayo(2);
      await fuente.guardarRespuesta(77, 901, 1);
      final entrega = await fuente.entregar(77);

      final [disponibilidad, inicio, respuesta, entregar] =
          adaptador.peticiones;
      expect(disponibilidad.method, 'GET');
      expect(disponibilidad.queryParameters, {'pruebaId': 2});
      expect(mini.disponible, isTrue);
      expect(mini.gratisRestantes, 1);
      expect(inicio.data, {'pruebaId': 2});
      // En orden, con las alternativas por letra; le queda toda la duración.
      expect(evaluacion.preguntas.map((p) => p.itemId), [901, 902]);
      expect(evaluacion.preguntas.first.alternativas.first.letra, 'A');
      expect(evaluacion.segundosRestantes, 48 * 60);
      expect(respuesta.method, 'POST');
      expect(respuesta.data, {'alternativaId': 1});
      expect(entregar.path, '/evaluaciones/77/entregar');
      expect(entrega.estado, 'entregada');
    });

    test('la abierta con tiempo trae sus preguntas y lo elegido', () {
      final consulta = PracticaModelo.evaluacionAbierta({
        'abierta': {
          'id': 42,
          'tipo': {'codigo': 'mini_ensayo', 'nombre': 'Mini-ensayo'},
          'prueba': {'id': 2, 'codigo': 'M1', 'nombre': 'Competencia M1'},
          'alcance': {'tipo': 'prueba', 'id': 2, 'nombre': 'M1'},
          'dificultad': {'id': null, 'codigo': 'mezcla', 'nombre': 'Mezcla'},
          'cantidad': 1,
          'respondidas': 1,
          'segundosRestantes': 600,
          'preguntas': [
            {
              'id': 901,
              'orden': 1,
              'enunciado': 'Pregunta 1',
              'texto': {'titulo': 'Texto 1', 'contenido': 'Había una vez'},
              'alternativas': [
                {'id': 1, 'letra': 'A', 'texto': 'uno'},
              ],
              'alternativaElegidaId': 1,
              'respondidaEn': '2026-10-31T23:01:00.000Z',
            },
          ],
        },
        'cerrada': null,
      });

      final abierta = consulta.abierta!.conReloj;
      expect(abierta.tipoNombre, 'Mini-ensayo');
      expect(abierta.segundosRestantes, 600);
      expect(abierta.preguntas.single.elegidaId, 1);
      expect(abierta.preguntas.single.texto?.titulo, 'Texto 1');
    });

    test('el uso gratis vuelve el primero del mes siguiente', () {
      expect(proximoMes(DateTime(2026, 10, 31)), '1 de noviembre');
      expect(proximoMes(DateTime(2026, 12, 5)), '1 de enero');
    });
  });

  group('Evaluaciones (A25)', () {
    testWidgets('muestra el diagnóstico, el mini-ensayo y el ensayo completo '
        'de la prueba a reforzar', (tester) async {
      final (repo, _) = await _abrirEvaluaciones(
        tester,
        evaluaciones: RepositorioEvaluacionesFalso()
          ..diagnosticoDisponible = true,
      );

      expect(repo.consultadas, [2]);
      expect(find.text('Diagnóstico'), findsOne);
      expect(find.text('Disponible'), findsOne);
      expect(find.text('Mini-ensayo'), findsOne);
      expect(find.text('1 gratis este mes'), findsOne);
      expect(
        find.text('22 preguntas · 48 min · un tercio de la prueba oficial'),
        findsOne,
      );
      await tester.scrollUntilVisible(
        find.text('Ensayo completo'),
        200,
        scrollable: find.byType(Scrollable).first,
      );
      expect(find.text('Todas las pruebas'), findsOne);
    });

    testWidgets('otra prueba consulta su mini-ensayo', (tester) async {
      final (repo, _) = await _abrirEvaluaciones(tester);

      await tocar(tester, find.text('Lectora'));

      expect(repo.consultadas, [2, 1]);
    });

    testWidgets('sin el uso gratis del mes, el motivo y «Ver planes»', (
      tester,
    ) async {
      final repo = RepositorioEvaluacionesFalso()
        ..mini = const DisponibilidadMiniEnsayo(
          pruebaId: 2,
          cantidad: 22,
          duracionMin: 48,
          ejes: 4,
          habilidades: 0,
          conPlan: false,
          gratisRestantes: 0,
          disponible: false,
        );
      final (_, contenedor) = await _abrirEvaluaciones(
        tester,
        evaluaciones: repo,
      );

      expect(find.text('Rendido'), findsOne);
      expect(find.textContaining('desde marzo de 2027'), findsOne);
      expect(find.text('Usado este mes'), findsOne);
      expect(find.text('Rendir mini-ensayo'), findsNothing);
      expect(find.textContaining('Ya usaste tu mini-ensayo gratis'), findsOne);

      await tocar(tester, find.text('Ver planes').first);
      expect(rutaActual(contenedor), rutaPlanesEnRama(Rutas.evaluaciones));
    });

    testWidgets('con un plan que cubre la prueba, «Incluido en tu plan»', (
      tester,
    ) async {
      final repo = RepositorioEvaluacionesFalso()
        ..mini = const DisponibilidadMiniEnsayo(
          pruebaId: 2,
          cantidad: 22,
          duracionMin: 48,
          ejes: 4,
          habilidades: 0,
          conPlan: true,
          gratisRestantes: null,
          disponible: true,
        );
      await _abrirEvaluaciones(tester, evaluaciones: repo);

      expect(find.text('Incluido en tu plan'), findsOne);
    });
  });

  group('Antes de empezar (A26)', () {
    testWidgets('explica las condiciones y el uso gratis', (tester) async {
      final (_, contenedor) = await _abrirEvaluaciones(tester);

      await tocar(tester, find.text('Rendir mini-ensayo'));

      expect(rutaActual(contenedor), Rutas.antesDeEmpezar);
      expect(find.text('Matemática M1'), findsOne);
      expect(find.text('22'), findsOne);
      expect(find.text('48'), findsOne);
      expect(find.text('ejes'), findsOne);
      expect(find.textContaining('El reloj sigue corriendo'), findsOne);
      expect(find.textContaining('cuentan como incorrectas'), findsOne);
      expect(
        find.text('Solo contenidos que se enseñan hasta 3° medio.'),
        findsOne,
      );
      expect(
        find.text('Usarás tu mini-ensayo gratis de M1 de este mes.'),
        findsOne,
      );
    });

    testWidgets('avisa que la práctica abierta se cerrará (RN-19)', (
      tester,
    ) async {
      final practica = RepositorioPracticaFalso()
        ..consultaAbierta = const ConsultaEvaluacionAbierta(
          abierta: EvaluacionAbierta(
            id: 41,
            tipo: 'practica',
            tipoNombre: 'Práctica',
            pruebaId: 2,
            prueba: 'Matemática M1',
            alcance: Alcance.todaLaPrueba,
            dificultadId: null,
            cantidad: 10,
            respondidas: 3,
          ),
        );
      await _abrirEvaluaciones(tester, practica: practica);

      await tocar(tester, find.text('Rendir mini-ensayo'));

      expect(
        find.textContaining(
          'Tu práctica sin terminar se cerrará y conservará lo respondido.',
        ),
        findsOne,
      );
    });

    testWidgets('si el servidor lo rechaza, muestra el motivo', (tester) async {
      final repo = RepositorioEvaluacionesFalso();
      repo.erroresAlIniciar.add(
        const ErrorApi(
          codigo: 'USO_GRATIS_AGOTADO',
          mensaje:
              'Ya usaste tu mini-ensayo gratis de esta prueba este mes. '
              'Puedes esperar al próximo mes o ver los planes.',
        ),
      );
      final (_, contenedor) = await _abrirEvaluaciones(
        tester,
        evaluaciones: repo,
      );

      await _empezar(tester);

      expect(rutaActual(contenedor), Rutas.antesDeEmpezar);
      expect(
        find.textContaining('Puedes esperar al próximo mes'),
        findsWidgets,
      );
    });

    testWidgets('con otra evaluación con tiempo abierta, ofrece retomarla '
        '(CU-10 2.b)', (tester) async {
      final repo = RepositorioEvaluacionesFalso();
      repo.erroresAlIniciar.add(
        const ErrorApi(
          codigo: 'EVALUACION_CON_TIEMPO_ABIERTA',
          mensaje: 'Termina tu evaluación con tiempo antes de empezar otra.',
        ),
      );
      final practica = RepositorioPracticaFalso();
      final (_, contenedor) = await _abrirEvaluaciones(
        tester,
        evaluaciones: repo,
        practica: practica,
      );
      await tocar(tester, find.text('Rendir mini-ensayo'));
      practica.consultaAbierta = ConsultaEvaluacionAbierta(
        abierta: _miniAbierto(),
      );

      await tester.tap(find.text('Empezar ahora'));
      await tester.pumpAndSettle();
      expect(find.text('Tienes un mini-ensayo sin terminar'), findsOne);

      await tester.tap(find.text('Continuar').last);
      await tester.pumpAndSettle();
      expect(rutaActual(contenedor), Rutas.preguntaConReloj);
    });
  });

  group('Pregunta con reloj (A27)', () {
    testWidgets('empieza en la primera con el reloj y guarda sin corregir', (
      tester,
    ) async {
      final (repo, contenedor) = await _abrirEvaluaciones(tester);

      await _empezar(tester);

      expect(repo.iniciadas, [2]);
      expect(rutaActual(contenedor), Rutas.preguntaConReloj);
      expect(find.text('Mini-ensayo · M1'), findsOne);
      expect(find.text('48:00'), findsOne);
      expect(find.text('Pregunta 1 de 3'), findsOne);

      await tester.tap(find.text('3'));
      await tester.pumpAndSettle();
      expect(repo.guardadas, [(77, 2001, 12)]);
      expect(
        find.text('Respuesta guardada. Puedes cambiarla hasta entregar.'),
        findsOne,
      );
      // Sin corrección: no dice si es correcta.
      expect(find.textContaining('Correcta'), findsNothing);

      // Se puede cambiar.
      await tester.tap(find.text('2'));
      await tester.pumpAndSettle();
      expect(repo.guardadas.last, (77, 2001, 11));
    });

    testWidgets('avanza y vuelve atrás conservando lo elegido', (tester) async {
      await _abrirEvaluaciones(tester);
      await _empezar(tester);
      await tester.tap(find.text('3'));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Siguiente'));
      await tester.pumpAndSettle();
      expect(find.text('Pregunta 2 de 3'), findsOne);
      expect(
        find.text('Respuesta guardada. Puedes cambiarla hasta entregar.'),
        findsNothing,
      );

      await tester.tap(find.text('Anterior'));
      await tester.pumpAndSettle();
      expect(find.text('Pregunta 1 de 3'), findsOne);
      expect(
        find.text('Respuesta guardada. Puedes cambiarla hasta entregar.'),
        findsOne,
      );
    });

    testWidgets('si no se pudo guardar, lo avisa y no la marca', (
      tester,
    ) async {
      final repo = RepositorioEvaluacionesFalso()
        ..errorAlGuardar = const ErrorApi(
          codigo: 'SIN_CONEXION',
          mensaje: 'No hay conexión con el servidor.',
        );
      await _abrirEvaluaciones(tester, evaluaciones: repo);
      await _empezar(tester);

      await tester.tap(find.text('3'));
      await tester.pumpAndSettle();

      expect(find.text('No hay conexión con el servidor.'), findsOne);
      expect(find.textContaining('Respuesta guardada'), findsNothing);
    });

    testWidgets('al acabarse el tiempo se entrega sola y abre el resultado '
        '(RN-21)', (tester) async {
      final (repo, contenedor) = await _abrirEvaluaciones(tester);
      await _empezar(tester);

      await tester.pump(const Duration(minutes: 47, seconds: 59));
      expect(find.text('0:01'), findsOne);
      await tester.pump(const Duration(seconds: 1));
      await tester.pumpAndSettle();

      expect(repo.entregadas, [77]);
      expect(rutaActual(contenedor), Rutas.resultado);
      expect(contenedor.read(evaluacionConsultadaProvider), 77);
      expect(contenedor.read(evaluacionConTiempoProvider), isNull);
    });

    testWidgets('«Salir» deja el mini-ensayo abierto para retomarlo', (
      tester,
    ) async {
      final (_, contenedor) = await _abrirEvaluaciones(tester);
      await _empezar(tester);

      await tester.tap(find.text('Salir'));
      await tester.pumpAndSettle();

      expect(rutaActual(contenedor), Rutas.evaluaciones);
      expect(contenedor.read(evaluacionConTiempoProvider), isNotNull);
    });
  });

  group('Ver todas y entregar (A28)', () {
    testWidgets('muestra el mapa, lleva a una pregunta y entrega', (
      tester,
    ) async {
      final (repo, contenedor) = await _abrirEvaluaciones(tester);
      await _empezar(tester);
      await tester.tap(find.text('3'));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Ver todas'));
      await tester.pumpAndSettle();
      expect(rutaActual(contenedor), Rutas.verTodas);
      expect(find.text('Respondidas 1'), findsOne);
      expect(find.text('Sin responder 2'), findsOne);
      expect(
        find.text(
          'Si entregas ahora, las 2 sin responder cuentan como incorrectas '
          'y pasan a tu repaso.',
        ),
        findsOne,
      );

      await tester.tap(find.bySemanticsLabel('Pregunta 3, sin responder'));
      await tester.pumpAndSettle();
      expect(rutaActual(contenedor), Rutas.preguntaConReloj);
      expect(find.text('Pregunta 3 de 3'), findsOne);

      await tester.tap(find.text('Entregar'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Entregar ahora'));
      await tester.pumpAndSettle();
      expect(repo.entregadas, [77]);
      expect(rutaActual(contenedor), Rutas.resultado);
    });

    testWidgets('«Seguir respondiendo» vuelve a la pregunta', (tester) async {
      final (_, contenedor) = await _abrirEvaluaciones(tester);
      await _empezar(tester);
      await tester.tap(find.text('Entregar'));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Seguir respondiendo'));
      await tester.pumpAndSettle();

      expect(rutaActual(contenedor), Rutas.preguntaConReloj);
      expect(find.text('Pregunta 1 de 3'), findsOne);
    });
  });

  group('Retomar (A29)', () {
    Future<ProviderContainer> abrirInicio(WidgetTester tester) async {
      final practica = RepositorioPracticaFalso()
        ..consultaAbierta = ConsultaEvaluacionAbierta(abierta: _miniAbierto());
      final contenedor = crearContenedor(
        sesion: sesionDeEjemplo,
        practica: practica,
      );
      await iniciarApp(tester, contenedor, ruta: Rutas.inicio);
      return contenedor;
    }

    testWidgets('«Continuar» vuelve a la primera sin responder, con el reloj '
        'que siguió corriendo', (tester) async {
      final contenedor = await abrirInicio(tester);

      // La hoja se abre sola en Inicio, sobre su tarjeta.
      await tester.tap(find.text('Continuar').last);
      await tester.pumpAndSettle();

      expect(rutaActual(contenedor), Rutas.preguntaConReloj);
      expect(find.text('Pregunta 2 de 3'), findsOne);
      expect(find.text('18:05'), findsOne);

      await tester.tap(find.text('Anterior'));
      await tester.pumpAndSettle();
      expect(find.textContaining('Respuesta guardada'), findsOne);
    });

    testWidgets('«Entregar ahora» abre el mapa para entregar', (tester) async {
      final contenedor = await abrirInicio(tester);

      await tester.tap(find.text('Entregar ahora'));
      await tester.pumpAndSettle();

      expect(rutaActual(contenedor), Rutas.verTodas);
      expect(find.text('Respondidas 1'), findsOne);
    });
  });

  group('Letra grande (RNF-12)', () {
    for (final ruta in [Rutas.antesDeEmpezar, Rutas.preguntaConReloj]) {
      testWidgets('con la letra al doble, A25 a A28 no se desbordan ($ruta)', (
        tester,
      ) async {
        tester.platformDispatcher.textScaleFactorTestValue = 2;
        addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
        final (_, contenedor) = await _abrirEvaluaciones(tester);
        expect(tester.takeException(), isNull);
        await tocar(tester, find.text('Rendir mini-ensayo'));
        expect(tester.takeException(), isNull);
        if (ruta == Rutas.preguntaConReloj) {
          // Con la letra al doble el botón baja al final del contenido.
          await tocar(tester, find.text('Empezar ahora'));
          expect(tester.takeException(), isNull);
          await ir(tester, contenedor, Rutas.verTodas);
          expect(tester.takeException(), isNull);
        }
      });
    }
  });
}
