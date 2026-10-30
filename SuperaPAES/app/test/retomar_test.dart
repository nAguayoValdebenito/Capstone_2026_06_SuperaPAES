import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:supera_paes/datos/fuentes/fuente_practica_remota.dart';
import 'package:supera_paes/datos/modelos/practica_modelo.dart';
import 'package:supera_paes/dominio/entidades/evaluacion_abierta.dart';
import 'package:supera_paes/dominio/entidades/practica.dart';
import 'package:supera_paes/nucleo/constantes.dart';
import 'package:supera_paes/nucleo/errores.dart';
import 'package:supera_paes/presentacion/inicio/hoja_retomar_evaluacion.dart';

import 'apoyo/adaptador_http_falso.dart';
import 'apoyo/app_de_prueba.dart';
import 'apoyo/repositorio_cuentas_falso.dart';
import 'apoyo/repositorio_practica_falso.dart';

/// La práctica de M1 del eje Álgebra y funciones, media, con 3 de 10.
const EvaluacionAbierta _practica = EvaluacionAbierta(
  id: 41,
  tipo: 'practica',
  tipoNombre: 'Práctica',
  pruebaId: 2,
  prueba: 'Matemática M1',
  alcance: Alcance(TipoAlcance.eje, id: 11, nombre: 'Álgebra y funciones'),
  dificultadId: 2,
  cantidad: 10,
  respondidas: 3,
);

/// El mini-ensayo del boceto A29: 9 de 22, con 18:05 por delante.
const EvaluacionAbierta _miniEnsayo = EvaluacionAbierta(
  id: 42,
  tipo: 'mini_ensayo',
  tipoNombre: 'Mini-ensayo',
  pruebaId: 2,
  prueba: 'Matemática M1',
  alcance: Alcance.todaLaPrueba,
  dificultadId: null,
  cantidad: 22,
  respondidas: 9,
  segundosRestantes: 18 * 60 + 5,
);

Future<(RepositorioPracticaFalso, ProviderContainer)> _abrirInicio(
  WidgetTester tester,
  ConsultaEvaluacionAbierta consulta,
) async {
  final repo = RepositorioPracticaFalso()..consultaAbierta = consulta;
  final contenedor = crearContenedor(sesion: sesionDeEjemplo, practica: repo);
  await iniciarApp(tester, contenedor, ruta: Rutas.inicio);
  return (repo, contenedor);
}

void main() {
  group('Evaluación abierta en la API', () {
    test('lee la práctica con su alcance y la cerrada al consultarla', () {
      final consulta = PracticaModelo.evaluacionAbierta({
        'abierta': {
          'id': 41,
          'tipo': {'codigo': 'practica', 'nombre': 'Práctica'},
          'prueba': {'id': 2, 'codigo': 'M1', 'nombre': 'Competencia M1'},
          'alcance': {'tipo': 'eje', 'id': 11, 'nombre': 'Álgebra'},
          'dificultad': {'id': null, 'codigo': 'mezcla', 'nombre': 'Mezcla'},
          'cantidad': 10,
          'respondidas': 3,
          'venceEn': null,
          'segundosRestantes': null,
        },
        'cerrada': null,
      });

      final abierta = consulta.abierta!;
      expect(abierta.prueba, 'Matemática M1');
      expect(abierta.alcance.nombre, 'Álgebra');
      expect(abierta.dificultadId, isNull);
      expect(abierta.conTiempo, isFalse);
      expect(abierta.esPractica, isTrue);

      final cerrada = PracticaModelo.evaluacionAbierta({
        'abierta': null,
        'cerrada': {
          'id': 40,
          'tipo': {'codigo': 'mini_ensayo', 'nombre': 'Mini-ensayo'},
          'estado': 'tiempo_agotado',
        },
      }).cerrada!;
      expect(cerrada.id, 40);
      expect(cerrada.porTiempo, isTrue);
    });

    test('toda la prueba queda sin nombre, como al iniciar', () {
      final abierta = PracticaModelo.evaluacionAbierta({
        'abierta': {
          'id': 41,
          'tipo': {'codigo': 'practica', 'nombre': 'Práctica'},
          'prueba': {'id': 2, 'codigo': 'M1', 'nombre': 'Competencia M1'},
          'alcance': {'tipo': 'prueba', 'id': 2, 'nombre': 'Competencia M1'},
          'dificultad': {'id': 2, 'codigo': 'media', 'nombre': 'Media'},
          'cantidad': 10,
          'respondidas': 0,
          'segundosRestantes': null,
        },
      }).abierta!;

      expect(abierta.alcance.tipo, TipoAlcance.prueba);
      expect(abierta.alcance.nombre, isNull);
      expect(abierta.dificultadId, 2);
    });

    test('la pide con GET a /evaluaciones/abierta', () async {
      final adaptador = AdaptadorHttpFalso(
        (_) => respuestaOk({'abierta': null, 'cerrada': null}),
      );

      final consulta = await FuentePracticaRemota(
        Dio()..httpClientAdapter = adaptador,
      ).evaluacionAbierta();

      expect(adaptador.peticiones.single.method, 'GET');
      expect(adaptador.peticiones.single.path, '/evaluaciones/abierta');
      expect(consulta.abierta, isNull);
    });

    test('el reloj de A29 va en minutos y, desde una hora, con horas', () {
      expect(relojDe(1085), '18:05');
      expect(relojDe(5), '0:05');
      expect(relojDe(3930), '1:05:30');
    });
  });

  group('Práctica sin terminar en Inicio (A12)', () {
    testWidgets('sin nada abierto no aparece', (tester) async {
      await _abrirInicio(tester, const ConsultaEvaluacionAbierta());

      expect(find.textContaining('sin terminar'), findsNothing);
    });

    testWidgets('«Seguir» vuelve a la pregunta pendiente con lo que se '
        'eligió (CU-28)', (tester) async {
      final (repo, contenedor) = await _abrirInicio(
        tester,
        const ConsultaEvaluacionAbierta(abierta: _practica),
      );
      repo.retomarCon(_practica);

      expect(find.text('Práctica sin terminar'), findsOne);
      expect(find.text('Matemática M1 · 3 de 10 respondidas'), findsOne);

      await tocar(tester, find.text('Seguir'));

      expect(rutaActual(contenedor), Rutas.pregunta);
      expect(find.text('Pregunta 4 de 10'), findsOne);
      expect(find.text('M1 · Álgebra y funciones · Media'), findsOne);
      expect(repo.iniciadas, isEmpty);
    });

    testWidgets('si se cerró por inactividad, lo avisa y abre su resultado '
        '(RN-19)', (tester) async {
      final (_, contenedor) = await _abrirInicio(
        tester,
        const ConsultaEvaluacionAbierta(
          cerrada: EvaluacionRecienCerrada(
            id: 41,
            tipoNombre: 'Práctica',
            porTiempo: false,
          ),
        ),
      );

      expect(find.text('Tu práctica se cerró por inactividad'), findsOne);
      await tocar(tester, find.text('Ver resultado'));

      expect(rutaActual(contenedor), Rutas.resultado);
    });
  });

  group('Retomar una evaluación con tiempo (A29)', () {
    testWidgets('al abrir Inicio la ofrece una vez, con el reloj corriendo, y '
        '«Continuar» lleva a Evaluaciones', (tester) async {
      final (_, contenedor) = await _abrirInicio(
        tester,
        const ConsultaEvaluacionAbierta(abierta: _miniEnsayo),
      );

      expect(find.text('Tienes un mini-ensayo sin terminar'), findsOne);
      expect(
        find.text(
          'Matemática M1 · 9 de 22 respondidas. Tus respuestas están '
          'guardadas.',
        ),
        findsOne,
      );
      expect(find.text('18:05'), findsOne);
      await tester.pump(const Duration(seconds: 1));
      expect(find.text('18:04'), findsOne);

      await tester.tap(find.text('Continuar').last);
      await tester.pumpAndSettle();
      expect(rutaActual(contenedor), Rutas.evaluaciones);

      // De vuelta en Inicio no se ofrece otra vez: queda su tarjeta.
      await ir(tester, contenedor, Rutas.inicio);
      expect(find.text('Tienes un mini-ensayo sin terminar'), findsNothing);
      expect(find.text('Mini-ensayo sin terminar'), findsOne);
    });

    testWidgets('si el tiempo se acaba con la hoja abierta, ofrece el '
        'resultado (RN-21)', (tester) async {
      final (repo, contenedor) = await _abrirInicio(
        tester,
        const ConsultaEvaluacionAbierta(
          abierta: EvaluacionAbierta(
            id: 42,
            tipo: 'mini_ensayo',
            tipoNombre: 'Mini-ensayo',
            pruebaId: 2,
            prueba: 'Matemática M1',
            alcance: Alcance.todaLaPrueba,
            dificultadId: null,
            cantidad: 22,
            respondidas: 9,
            segundosRestantes: 2,
          ),
        ),
      );
      final consultas = repo.consultasAbierta;

      await tester.pump(const Duration(seconds: 2));
      await tester.pump();

      expect(find.text('Se acabó el tiempo'), findsOne);
      await tester.tap(find.text('Ver resultado'));
      await tester.pumpAndSettle();
      expect(rutaActual(contenedor), Rutas.resultado);
      expect(repo.consultasAbierta, greaterThan(consultas));
    });

    testWidgets('si se cerró por tiempo antes de volver, Inicio lo avisa', (
      tester,
    ) async {
      await _abrirInicio(
        tester,
        const ConsultaEvaluacionAbierta(
          cerrada: EvaluacionRecienCerrada(
            id: 42,
            tipoNombre: 'Mini-ensayo',
            porTiempo: true,
          ),
        ),
      );

      expect(find.text('Se acabó el tiempo de tu mini-ensayo'), findsOne);
      expect(find.text('Se corrigió con lo que respondiste.'), findsOne);
    });

    testWidgets('al empezar una práctica con una evaluación con tiempo '
        'abierta, ofrece retomarla (CU-10 2.b)', (tester) async {
      final repo = RepositorioPracticaFalso()
        ..erroresAlIniciar.add(
          const ErrorApi(
            codigo: 'EVALUACION_CON_TIEMPO_ABIERTA',
            mensaje: 'Termina tu evaluación con tiempo antes de empezar otra.',
          ),
        );
      final contenedor = crearContenedor(
        sesion: sesionDeEjemplo,
        practica: repo,
      );
      await iniciarApp(tester, contenedor, ruta: Rutas.practicar);
      repo.consultaAbierta = const ConsultaEvaluacionAbierta(
        abierta: _miniEnsayo,
      );

      await tocar(tester, find.text('Empezar práctica'));

      expect(find.text('Tienes un mini-ensayo sin terminar'), findsOne);
      expect(rutaActual(contenedor), Rutas.practicar);
    });

    testWidgets('si ya no estaba abierta, muestra el mensaje', (tester) async {
      final repo = RepositorioPracticaFalso()
        ..erroresAlIniciar.add(
          const ErrorApi(
            codigo: 'EVALUACION_CON_TIEMPO_ABIERTA',
            mensaje: 'Termina tu evaluación con tiempo antes de empezar otra.',
          ),
        );
      await iniciarApp(
        tester,
        crearContenedor(sesion: sesionDeEjemplo, practica: repo),
        ruta: Rutas.practicar,
      );

      await tocar(tester, find.text('Empezar práctica'));

      expect(
        find.text('Termina tu evaluación con tiempo antes de empezar otra.'),
        findsOne,
      );
    });

    testWidgets('con la letra al doble la hoja no se desborda (RNF-12)', (
      tester,
    ) async {
      tester.platformDispatcher.textScaleFactorTestValue = 2;
      addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);

      await _abrirInicio(
        tester,
        const ConsultaEvaluacionAbierta(abierta: _miniEnsayo),
      );

      expect(find.text('Tienes un mini-ensayo sin terminar'), findsOne);
      expect(tester.takeException(), isNull);
      // La hoja se desplaza: «Cerrar» queda abajo.
      await tester.ensureVisible(find.text('Cerrar'));
      await tester.pump();
      await tester.tap(find.text('Cerrar'));
      await tester.pumpAndSettle();
      await tester.scrollUntilVisible(
        find.text('Mini-ensayo sin terminar'),
        200,
        scrollable: find.byType(Scrollable).first,
      );
      expect(tester.takeException(), isNull);
    });
  });
}
