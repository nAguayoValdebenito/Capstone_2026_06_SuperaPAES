import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:supera_paes/datos/modelos/resultado_modelo.dart';
import 'package:supera_paes/dominio/entidades/resultado_evaluacion.dart';
import 'package:supera_paes/nucleo/constantes.dart';
import 'package:supera_paes/nucleo/errores.dart';
import 'package:supera_paes/presentacion/comunes/componentes_seleccion.dart';
import 'package:supera_paes/presentacion/resultado/estado_resultado.dart';
import 'package:supera_paes/presentacion/resultado/partes_resultado.dart';

import 'apoyo/app_de_prueba.dart';
import 'apoyo/repositorio_cuentas_falso.dart';
import 'apoyo/repositorio_practica_falso.dart';
import 'apoyo/repositorio_resultados_falso.dart';

/// Abre el resultado (A30) o la revisión (A33) de la evaluación 41.
Future<ProviderContainer> _abrir(
  WidgetTester tester, {
  RepositorioResultadosFalso? repositorio,
  String ruta = Rutas.resultado,
}) async {
  final contenedor = crearContenedor(
    sesion: sesionDeEjemplo,
    resultados: repositorio,
  );
  await iniciarApp(tester, contenedor);
  contenedor.read(evaluacionConsultadaProvider.notifier).evaluacion = 41;
  await ir(tester, contenedor, ruta);
  return contenedor;
}

/// Texto con partes en negrita (los avisos con `textoRico`).
Finder _textoRico(String texto) => find.text(texto, findRichText: true);

OpcionAlternativa _alternativa(WidgetTester tester, String letra) =>
    tester.widget<OpcionAlternativa>(
      find.byWidgetPredicate(
        (widget) => widget is OpcionAlternativa && widget.letra == letra,
      ),
    );

void main() {
  group('Resultado de la evaluación (A30, A32 y A32b)', () {
    testWidgets('mini-ensayo: porcentaje, tiempo y resultado por eje y por '
        'habilidad (HU-61 esc. 1)', (tester) async {
      final repositorio = RepositorioResultadosFalso();
      await _abrir(tester, repositorio: repositorio);

      expect(repositorio.resultadosPedidos, [41]);
      expect(find.text('Mini-ensayo · Entregado'), findsOne);
      expect(find.text('Matemática M1'), findsOne);
      expect(find.text('68 %'), findsOne);
      expect(find.text('15 de 22 correctas'), findsOne);
      expect(find.text('Tiempo usado: 44 de 48 min'), findsOne);
      expect(find.text('omitidas'), findsOne);
      expect(find.text('5 de 6 · 83 %'), findsOne);
      expect(find.text('Resolver problemas'), findsNothing);
      expect(
        _textoRico(
          'Las 4 incorrectas y las 3 omitidas pasaron a Repasar errores.',
        ),
        findsOne,
      );

      await tocar(tester, find.text('Por habilidad'));
      expect(find.text('Resolver problemas'), findsOne);
      expect(find.text('15 de 22 · 68 %'), findsOne);
    });

    testWidgets('ensayo: puntaje estimado con su tabla, y las que no puntúan '
        'no cuentan (A32, RN-23)', (tester) async {
      await _abrir(
        tester,
        repositorio: RepositorioResultadosFalso(resultado: ensayoDePrueba),
      );

      expect(find.text('Ensayo completo · Entregado'), findsOne);
      expect(find.text('Puntaje estimado'), findsOne);
      expect(find.text('742'), findsOne);
      expect(
        find.text(
          'Escala de 100 a 1.000 · tabla de conversión DEMRE, admisión 2026 '
          '(regular)',
        ),
        findsOne,
      );
      expect(
        find.text('Es una estimación, no un resultado oficial del DEMRE.'),
        findsOne,
      );
      expect(
        find.text(
          'Se consideran las 60 preguntas que puntúan. Las otras 5, como en '
          'la PAES, no cuentan. Tiempo usado: 2 h 11 min de 2 h 20 min.',
        ),
        findsOne,
      );
    });

    testWidgets('ensayo sin tabla de conversión: porcentaje y aviso (A32b)', (
      tester,
    ) async {
      const sinTabla = ResultadoEvaluacion(
        id: 43,
        tipo: 'ensayo',
        tipoNombre: 'Ensayo completo',
        prueba: 'Competencia Lectora',
        estado: 'tiempo_agotado',
        cantidad: 65,
        puntuables: 60,
        correctas: 45,
        incorrectas: 15,
        omitidas: 0,
        porcentaje: 75,
        tiempoUsadoSeg: 150 * 60,
        duracionMin: 150,
        recalculado: true,
        ejes: [],
        habilidades: [],
      );
      await _abrir(
        tester,
        repositorio: RepositorioResultadosFalso(resultado: sinTabla),
      );

      expect(find.text('Ensayo completo · Tiempo agotado'), findsOne);
      expect(find.text('75 %'), findsOne);
      expect(find.text('Puntaje estimado'), findsNothing);
      expect(
        find.textContaining('todavía no tiene una tabla de conversión'),
        findsOne,
      );
      expect(find.textContaining('se recalculó'), findsOne);
      expect(
        _textoRico('Las 15 incorrectas pasaron a Repasar errores.'),
        findsOne,
      );
    });

    testWidgets('si no carga, muestra el error y «Reintentar» lo vuelve a '
        'pedir', (tester) async {
      final repositorio = RepositorioResultadosFalso()
        ..error = const ErrorApi(
          codigo: 'SIN_CONEXION',
          mensaje: 'No hay conexión con el servidor.',
        );
      await _abrir(tester, repositorio: repositorio);
      expect(find.text('No hay conexión con el servidor.'), findsOne);
      expect(find.text('Revisar pregunta por pregunta'), findsNothing);

      repositorio.error = null;
      await tocar(tester, find.text('Reintentar'));
      expect(find.text('68 %'), findsOne);
    });

    testWidgets('«Revisar pregunta por pregunta» abre A33 y «Cerrar» vuelve', (
      tester,
    ) async {
      final contenedor = await _abrir(tester);

      await tocar(tester, find.text('Revisar pregunta por pregunta'));
      expect(rutaActual(contenedor), Rutas.revision);

      await tocar(tester, find.text('Resultado'));
      expect(rutaActual(contenedor), Rutas.resultado);
      await tocar(tester, find.text('Cerrar'));
      expect(rutaActual(contenedor), Rutas.evaluaciones);
    });
  });

  group('Revisión pregunta por pregunta (A33)', () {
    testWidgets('muestra cada pregunta corregida con su explicación y avanza '
        '(HU-61 esc. 2)', (tester) async {
      await _abrir(tester, ruta: Rutas.revision);

      expect(find.text('Todas (3)'), findsOne);
      expect(find.text('Incorrectas (1)'), findsOne);
      expect(find.text('Omitidas (1)'), findsOne);
      expect(find.text('Pregunta 1 de 3 · Números'), findsOne);
      expect(find.text('Correcta'), findsOne);
      expect(_alternativa(tester, 'C').etiqueta, 'Tu respuesta');
      expect(find.text('Explicación de la pregunta 1'), findsOne);
      expect(
        find.text(
          'Se muestra tal como la viste, aunque después se haya editado.',
        ),
        findsOne,
      );

      await tocar(tester, find.text('Siguiente'));
      expect(find.text('Pregunta 2 de 3 · Geometría'), findsOne);
      expect(find.text('Incorrecta'), findsOne);
      expect(_alternativa(tester, 'A').etiqueta, 'Tu respuesta');
      expect(_alternativa(tester, 'C').etiqueta, 'Correcta');
      expect(find.text('Por qué la A no es correcta'), findsOne);

      await tocar(tester, find.text('Anterior'));
      expect(find.text('Pregunta 1 de 3 · Números'), findsOne);
    });

    testWidgets('los filtros muestran solo las incorrectas o las omitidas', (
      tester,
    ) async {
      await _abrir(tester, ruta: Rutas.revision);

      await tocar(tester, find.text('Omitidas (1)'));
      expect(find.text('Pregunta 3 de 3 · Números'), findsOne);
      expect(find.text('Omitida'), findsOne);
      expect(_alternativa(tester, 'C').etiqueta, 'Correcta');
      expect(_alternativa(tester, 'A').etiqueta, isNull);
      // Una sola pregunta: sin «Anterior» ni «Siguiente».
      expect(find.text('Siguiente'), findsNothing);

      await tocar(tester, find.text('Incorrectas (1)'));
      expect(find.text('Pregunta 2 de 3 · Geometría'), findsOne);
    });

    testWidgets('«Ver la revisión» de A21 abre la revisión de esa práctica', (
      tester,
    ) async {
      final repositorio = RepositorioResultadosFalso();
      final contenedor = crearContenedor(
        sesion: sesionDeEjemplo,
        practica: RepositorioPracticaFalso(),
        resultados: repositorio,
      );
      await iniciarApp(tester, contenedor, ruta: Rutas.practicar);
      await tocar(tester, find.text('Empezar práctica'));
      await tocar(tester, find.text('Terminar'));
      await tester.tap(find.widgetWithText(TextButton, 'Terminar').last);
      await tester.pumpAndSettle();
      expect(rutaActual(contenedor), Rutas.resumenPractica);

      await tocar(tester, find.text('Ver la revisión'));

      expect(rutaActual(contenedor), Rutas.revision);
      expect(repositorio.revisionesPedidas, [resumenDeEjemplo.id]);
      expect(find.text('Pregunta 1 de 3 · Números'), findsOne);
    });
  });

  testWidgets('A30 y A33 aguantan letra grande sin desbordarse (RNF-12)', (
    tester,
  ) async {
    // Se sube la letra ya en A30: Inicio, donde parte la app, se prueba aparte.
    final contenedor = await _abrir(tester);
    tester.platformDispatcher.textScaleFactorTestValue = 2;
    addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
    await tester.pumpAndSettle();
    expect(find.text('68 %'), findsOne);

    await ir(tester, contenedor, Rutas.revision);
    expect(find.text('Pregunta 1 de 3 · Números'), findsOne);
    expect(tester.takeException(), isNull);
  });

  group('Datos del resultado', () {
    test('ResultadoModelo lee el resultado del contrato (HU-61)', () {
      final resultado = ResultadoModelo.resultado({
        'id': 41,
        'tipo': {'codigo': 'ensayo', 'nombre': 'Ensayo completo'},
        'prueba': {'id': 2, 'codigo': 'M1', 'nombre': 'Matemática 1'},
        'estado': {'codigo': 'entregada', 'nombre': 'Entregada'},
        'duracionMin': 140,
        'cantidad': 65,
        'puntuables': 60,
        'correctas': 46,
        'incorrectas': 10,
        'omitidas': 4,
        'porcentaje': 76.7,
        'tiempoUsadoSeg': 7860,
        'puntaje': 742,
        'tablaConversion': {'anioAdmision': 2026, 'proceso': 'Regular'},
        'recalculadoEn': null,
        'ejes': [
          {'id': 3, 'nombre': 'Números', 'preguntas': 16, 'correctas': 14},
        ],
        'habilidades': <Object?>[],
      });

      expect(resultado.prueba, 'Matemática M1');
      expect(resultado.esEnsayo, isTrue);
      expect(resultado.tablaConversion?.anioAdmision, 2026);
      expect(resultado.recalculado, isFalse);
      expect(resultado.ejes.single.porcentaje, closeTo(87.5, 0.01));
    });

    test('ResultadoModelo lee la revisión, con la omitida sin elegida', () {
      final [omitida] = ResultadoModelo.revision({
        'id': 41,
        'preguntas': [
          {
            'orden': 13,
            'preguntaId': 900,
            'eje': {'id': 4, 'nombre': 'Geometría'},
            'resultado': 'omitida',
            'puntuable': false,
            'anulada': false,
            'texto': {'titulo': 'Texto', 'contenido': 'Un texto.'},
            'enunciado': 'Enunciado',
            'explicacion': 'Explicación',
            'alternativaElegidaId': null,
            'alternativaCorrectaId': 103,
            'alternativas': [
              {'id': 103, 'letra': 'C', 'texto': '36', 'explicacion': null},
            ],
          },
        ],
      });

      expect(omitida.resultado, ResultadoPregunta.omitida);
      expect(omitida.alternativaElegidaId, isNull);
      expect(omitida.elegida, isNull);
      expect(omitida.puntuable, isFalse);
      expect(omitida.texto?.titulo, 'Texto');
      expect(omitida.alternativas.single.id, 103);
    });

    test('duracionLegible: segundos, minutos y horas', () {
      expect(duracionLegible(40), '40 s');
      expect(duracionLegible(44 * 60), '44 min');
      expect(duracionLegible(131 * 60), '2 h 11 min');
      expect(duracionLegible(120 * 60), '2 h');
    });
  });
}
