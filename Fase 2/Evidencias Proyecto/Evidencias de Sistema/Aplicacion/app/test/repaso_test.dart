import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:supera_paes/datos/modelos/por_repasar_modelo.dart';
import 'package:supera_paes/dominio/entidades/evaluacion_abierta.dart';
import 'package:supera_paes/dominio/entidades/por_repasar.dart';
import 'package:supera_paes/dominio/entidades/practica.dart';
import 'package:supera_paes/nucleo/constantes.dart';
import 'package:supera_paes/nucleo/errores.dart';
import 'package:supera_paes/presentacion/comunes/estado_cuenta.dart';
import 'package:supera_paes/presentacion/practicar/estado_practica.dart';
import 'package:supera_paes/presentacion/practicar/pantalla_resumen_practica.dart';

import 'apoyo/app_de_prueba.dart';
import 'apoyo/repositorio_cuentas_falso.dart';
import 'apoyo/repositorio_practica_falso.dart';

Future<RepositorioPracticaFalso> _abrir(
  WidgetTester tester, {
  PorRepasar? datos,
}) async {
  final repo = RepositorioPracticaFalso()
    ..datosPorRepasar = datos ?? repasoDeEjemplo;
  await iniciarApp(
    tester,
    crearContenedor(sesion: sesionDeEjemplo, practica: repo),
    ruta: Rutas.repaso,
  );
  return repo;
}

const PorRepasar _muchas = PorRepasar(
  total: 14,
  limite: null,
  pruebas: [
    PruebaPorRepasar(
      id: 1,
      codigo: 'M1',
      nombre: 'Matemática M1',
      preguntas: 14,
      ejes: [EjePorRepasar(id: 11, nombre: 'Números', preguntas: 14)],
    ),
  ],
);

void main() {
  group('Preguntas por repasar en la API', () {
    test('lee el total, el límite y las pruebas con sus ejes', () {
      final datos = PorRepasarModelo.desde({
        'total': 12,
        'limite': 10,
        'pruebas': [
          {
            'id': 2,
            'codigo': 'M1',
            'nombre': 'Matemática M1',
            'preguntas': 10,
            'ejes': [
              {'id': 3, 'nombre': 'Números', 'preguntas': 10},
            ],
          },
        ],
      });

      expect(datos.total, 12);
      expect(datos.limite, 10);
      expect(datos.repasables, 10);
      expect(datos.pruebas.single.ejes.single.nombre, 'Números');
    });

    test('con el plan Todas las pruebas no hay límite', () {
      expect(
        PorRepasarModelo.desde({
          'total': 0,
          'limite': null,
          'pruebas': <Object?>[],
        }).limite,
        isNull,
      );
    });
  });

  group('Repasar errores (A24)', () {
    testWidgets('sin errores, lo dice y ofrece practicar', (tester) async {
      await _abrir(tester, datos: repasoVacio);

      expect(find.text('No tienes errores por repasar'), findsOne);

      await tocar(tester, find.text('Ir a practicar'));
    });

    testWidgets('muestra la primera prueba con sus ejes', (tester) async {
      await _abrir(tester);

      expect(find.text('Repasar errores'), findsOne);
      expect(find.text('M1 (5)'), findsOne);
      expect(find.text('M2 (3)'), findsOne);
      expect(find.text('Geometría'), findsOne);
      expect(find.text('Repasar las 5'), findsOne);
      expect(find.text('Todas (8)'), findsNothing);
    });

    testWidgets('al cambiar de prueba, cambian los ejes y el botón', (
      tester,
    ) async {
      await _abrir(tester);

      await tocar(tester, find.text('M2 (3)'));

      expect(find.text('Geometría'), findsNothing);
      expect(find.text('Números'), findsOne);
      expect(find.text('Repasar las 3'), findsOne);
    });

    testWidgets('sin el plan Todas las pruebas avisa el límite', (
      tester,
    ) async {
      await _abrir(tester);

      expect(
        find.textContaining(
          'repasas tus 10 preguntas falladas más recientes',
          findRichText: true,
        ),
        findsOne,
      );
    });

    testWidgets('con el plan Todas las pruebas no avisa el límite', (
      tester,
    ) async {
      await _abrir(tester, datos: _muchas);

      expect(
        find.textContaining('falladas más recientes', findRichText: true),
        findsNothing,
      );
    });

    testWidgets('un repaso trae hasta 10 preguntas', (tester) async {
      await _abrir(tester, datos: _muchas);

      expect(find.text('Repasar 10 de 14'), findsOne);
    });

    testWidgets('el botón repasa la prueba y abre la pregunta', (tester) async {
      final repo = await _abrir(tester);

      await tocar(tester, find.text('Repasar las 5'));

      expect(repo.repasos.single, (1, null));
      expect(find.text('Responder'), findsOne);
    });

    testWidgets('un eje repasa solo ese eje', (tester) async {
      final repo = await _abrir(tester);

      await tocar(tester, find.text('Geometría'));

      expect(repo.repasos.single, (1, 12));
    });

    testWidgets('si el servidor rechaza, lo dice y se queda aquí', (
      tester,
    ) async {
      final repo = RepositorioPracticaFalso()
        ..datosPorRepasar = repasoDeEjemplo
        ..errorAlRepasar = const ErrorApi(
          codigo: 'SIN_PREGUNTAS_SUFICIENTES',
          mensaje: 'Ya no quedan preguntas por repasar.',
        );
      await iniciarApp(
        tester,
        crearContenedor(sesion: sesionDeEjemplo, practica: repo),
        ruta: Rutas.repaso,
      );

      await tocar(tester, find.text('Repasar las 5'));

      expect(find.text('Ya no quedan preguntas por repasar.'), findsOne);
    });

    testWidgets('con letra grande cabe en un teléfono chico', (tester) async {
      tester.platformDispatcher.textScaleFactorTestValue = 2;
      addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
      await _abrir(tester);

      tester.view.physicalSize = const Size(360, 640);
      await tester.pumpAndSettle();

      expect(tester.takeException(), isNull);
    });
  });

  group('Durante el repaso', () {
    Future<RepositorioPracticaFalso> enRepaso(WidgetTester tester) async {
      final repo = await _abrir(tester);
      await tocar(tester, find.text('Repasar las 5'));
      return repo;
    }

    testWidgets('no muestra el cupo: el repaso no lo usa (RN-04)', (
      tester,
    ) async {
      await enRepaso(tester);

      expect(find.textContaining('Hoy te quedan'), findsNothing);
    });

    testWidgets('dice que es un repaso, no una mezcla', (tester) async {
      await enRepaso(tester);

      expect(find.textContaining('Repaso'), findsOne);
      expect(find.textContaining('Mezcla'), findsNothing);
    });

    testWidgets('al confirmar habla del repaso, no de la práctica', (
      tester,
    ) async {
      await enRepaso(tester);

      await tocar(tester, find.text('32'));
      await tocar(tester, find.text('Responder'));

      expect(find.textContaining('En el repaso la corrección'), findsOne);
    });

    testWidgets('terminar pregunta por el repaso', (tester) async {
      await enRepaso(tester);

      await tocar(tester, find.text('Terminar'));

      expect(find.text('¿Terminar el repaso?'), findsOne);
      expect(find.text('Seguir repasando'), findsOne);
    });

    testWidgets('el resumen es del repaso y permite seguir repasando', (
      tester,
    ) async {
      await enRepaso(tester);

      await tocar(tester, find.text('Terminar'));
      await tocar(tester, find.text('Terminar').last);

      expect(find.text('Repaso terminado'), findsOne);
      expect(find.text('Seguir repasando'), findsOne);
      expect(find.text('Practicar de nuevo'), findsNothing);
      await tester.scrollUntilVisible(
        find.textContaining('salieron de tu lista', findRichText: true),
        150,
        scrollable: find.byType(Scrollable).first,
      );
      expect(
        find.textContaining('salieron de tu lista', findRichText: true),
        findsOne,
      );
    });
  });

  group('En Inicio (A12)', () {
    Future<RepositorioPracticaFalso> inicio(
      WidgetTester tester, {
      PorRepasar? datos,
      ConsultaEvaluacionAbierta? abierta,
    }) async {
      final repo = RepositorioPracticaFalso()
        ..datosPorRepasar = datos ?? repasoDeEjemplo;
      if (abierta != null) repo.consultaAbierta = abierta;
      await iniciarApp(
        tester,
        crearContenedor(sesion: sesionDeEjemplo, practica: repo),
        ruta: Rutas.inicio,
      );
      return repo;
    }

    testWidgets('ofrece repasar y abre A24', (tester) async {
      final contenedor = crearContenedor(
        sesion: sesionDeEjemplo,
        practica: RepositorioPracticaFalso()..datosPorRepasar = repasoDeEjemplo,
      );
      await iniciarApp(tester, contenedor, ruta: Rutas.inicio);

      expect(find.text('8 preguntas por repasar'), findsOne);

      await tocar(tester, find.text('Repasar'));

      expect(rutaActual(contenedor), Rutas.repaso);
    });

    testWidgets('sin errores no ocupa lugar', (tester) async {
      await inicio(tester, datos: repasoVacio);

      expect(find.textContaining('por repasar'), findsNothing);
    });

    testWidgets('el repaso sin terminar se puede seguir (HU-60)', (
      tester,
    ) async {
      await inicio(
        tester,
        datos: repasoVacio,
        abierta: const ConsultaEvaluacionAbierta(
          abierta: EvaluacionAbierta(
            id: 41,
            tipo: 'repaso',
            tipoNombre: 'Repaso de errores',
            pruebaId: 1,
            prueba: 'Matemática M1',
            alcance: Alcance.todaLaPrueba,
            dificultadId: null,
            cantidad: 5,
            respondidas: 2,
          ),
        ),
      );

      expect(find.text('Repaso de errores sin terminar'), findsOne);

      await tocar(tester, find.text('Seguir'));

      expect(find.textContaining('Hoy te quedan'), findsNothing);
      expect(find.textContaining('Repaso'), findsOne);
    });
  });

  test('el marcador coincide con el porcentaje si terminó antes (RN-22)', () {
    const terminoAntes = ResumenPractica(
      id: 1,
      prueba: 'Matemática M1',
      alcance: Alcance.todaLaPrueba,
      dificultad: 'Mezcla',
      cantidad: 4,
      correctas: 1,
      incorrectas: 0,
      omitidas: 0,
      porcentaje: 100,
      tiempoUsadoSeg: 39,
    );
    const sinResponder = ResumenPractica(
      id: 2,
      prueba: 'Matemática M1',
      alcance: Alcance.todaLaPrueba,
      dificultad: 'Mezcla',
      cantidad: 4,
      correctas: 0,
      incorrectas: 0,
      omitidas: 0,
      porcentaje: 0,
      tiempoUsadoSeg: 3,
    );

    expect(marcadorDe(terminoAntes), '1/1');
    expect(marcadorDe(sinResponder), '0/4');
    expect(marcadorDe(resumenDeEjemplo), '7/10');
  });

  test('una práctica nueva deja de ser repaso', () async {
    final contenedor = crearContenedor(sesion: sesionDeEjemplo);
    // Al leerse la sesión, la práctica vuelve a empezar: se espera antes.
    await contenedor.read(sesionProvider.future);
    final practica = contenedor.read(practicaProvider.notifier);

    await practica.iniciarRepaso(repasoDeEjemplo.pruebas.first);
    expect(contenedor.read(practicaProvider).esRepaso, isTrue);

    await practica.iniciar(
      const DatosPractica(
        pruebaId: 1,
        alcance: Alcance.todaLaPrueba,
        dificultadId: null,
        cantidad: 5,
      ),
    );
    expect(contenedor.read(practicaProvider).esRepaso, isFalse);
  });
}
