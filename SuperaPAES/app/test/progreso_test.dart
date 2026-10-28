import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:supera_paes/datos/modelos/progreso_modelo.dart';
import 'package:supera_paes/dominio/entidades/practica.dart';
import 'package:supera_paes/nucleo/constantes.dart';
import 'package:supera_paes/nucleo/errores.dart';
import 'package:supera_paes/presentacion/comunes/estado_cuenta.dart';
import 'package:supera_paes/presentacion/practicar/estado_practica.dart';
import 'package:supera_paes/presentacion/progreso/estado_progreso.dart';

import 'apoyo/app_de_prueba.dart';
import 'apoyo/repositorio_cuentas_falso.dart';
import 'apoyo/repositorio_progreso_falso.dart';

/// Desplaza Progreso hasta que el elemento se vea: la lista construye sus
/// tarjetas a medida que se desplaza.
Future<void> verHasta(WidgetTester tester, Finder elemento) async {
  await tester.scrollUntilVisible(
    elemento,
    200,
    scrollable: find.byType(Scrollable).first,
  );
  await tester.pumpAndSettle();
}

Future<void> elegirPrueba(WidgetTester tester, String chip) async {
  await tester.tap(find.text(chip));
  await tester.pumpAndSettle();
}

void main() {
  group('Progreso (A35 y A36)', () {
    testWidgets('muestra el acierto por dificultad, los ejes a reforzar, las '
        'semanas y los ensayos de la primera prueba (esc. 1 a 3)', (
      tester,
    ) async {
      await iniciarApp(
        tester,
        crearContenedor(sesion: sesionDeEjemplo),
        ruta: Rutas.progreso,
      );

      // M1 es la prueba a reforzar, así que va primero.
      expect(find.text('Acierto en M1'), findsOne);
      expect(find.text('68 %'), findsWidgets);
      for (final (dificultad, acierto) in [
        ('Fácil', '82 %'),
        ('Media', '66 %'),
        ('Difícil', '41 %'),
      ]) {
        expect(find.text(dificultad), findsOne);
        expect(find.text(acierto), findsOne, reason: dificultad);
      }
      expect(
        find.text('Suma prácticas y evaluaciones · 214 respuestas'),
        findsOne,
      );

      expect(find.text('Por eje'), findsOne);
      expect(find.text('Números'), findsOne);
      expect(find.text('Geometría'), findsOne);
      expect(find.text('A reforzar'), findsOne);

      await verHasta(tester, find.text('S6'));
      expect(find.text('Semana a semana'), findsOne);
      // El lector de pantalla lee cada barra como una sola frase.
      expect(
        tester.getSemantics(find.text('S6')),
        isSemantics(label: 'Semana del 19/10: 68 %'),
      );

      await verHasta(tester, find.text('742'));
      expect(find.text('Ensayos completos'), findsOne);
      expect(find.text('18/10/2026 · Puntaje estimado'), findsOne);
    });

    testWidgets('en Lectora muestra el acierto por habilidad (RN-14)', (
      tester,
    ) async {
      await iniciarApp(
        tester,
        crearContenedor(sesion: sesionDeEjemplo),
        ruta: Rutas.progreso,
      );

      await elegirPrueba(tester, 'Lectora');

      expect(find.text('Acierto en Lectora'), findsOne);
      expect(find.text('Por habilidad'), findsOne);
      expect(find.text('Interpretar'), findsOne);
      expect(find.text('A reforzar'), findsOne);
      expect(find.text('Eje de Lectora'), findsNothing);
      // Sin respuestas fáciles ni difíciles.
      expect(find.text('—'), findsNWidgets(2));
      expect(
        find.text('Suma prácticas y evaluaciones · 12 respuestas'),
        findsOne,
      );
      expect(find.text('Semana a semana'), findsNothing);
      expect(find.text('Ensayos completos'), findsNothing);
    });

    testWidgets('una prueba sin respuestas invita a practicarla (A36)', (
      tester,
    ) async {
      final contenedor = crearContenedor(sesion: sesionDeEjemplo);
      await iniciarApp(tester, contenedor, ruta: Rutas.progreso);

      await elegirPrueba(tester, 'Ciencias');

      expect(
        find.text('Todavía no respondes preguntas de Ciencias · Biología'),
        findsOne,
      );
      expect(find.text('Acierto en Ciencias'), findsNothing);

      await tocar(tester, find.text('Practicar Ciencias'));

      expect(rutaActual(contenedor), Rutas.practicar);
      expect(contenedor.read(borradorPracticaProvider).pruebaId, 5);
    });

    testWidgets('si no carga, muestra el error y deja reintentar', (
      tester,
    ) async {
      final repositorio = RepositorioProgresoFalso()
        ..error = const ErrorApi(
          codigo: 'SIN_CONEXION',
          mensaje: 'No hay conexión con el servidor.',
        );
      await iniciarApp(
        tester,
        crearContenedor(sesion: sesionDeEjemplo, progreso: repositorio),
        ruta: Rutas.progreso,
      );

      expect(find.text('No hay conexión con el servidor.'), findsOne);

      repositorio.error = null;
      await tocar(tester, find.text('Reintentar'));

      expect(find.text('Acierto en M1'), findsOne);
    });

    test('se vuelve a leer al cerrar una práctica', () async {
      final repositorio = RepositorioProgresoFalso();
      final contenedor = crearContenedor(
        sesion: sesionDeEjemplo,
        progreso: repositorio,
      );
      // Alguien mira el progreso, como la pestaña abierta.
      final escucha = contenedor.listen(progresoProvider, (_, _) {});
      addTearDown(escucha.close);
      await contenedor.read(sesionProvider.future);
      await contenedor.read(progresoProvider.future);
      expect(repositorio.consultas, 1);

      final practica = contenedor.read(practicaProvider.notifier);
      await practica.iniciar(
        const DatosPractica(
          pruebaId: 2,
          alcance: Alcance.todaLaPrueba,
          dificultadId: null,
          cantidad: 10,
        ),
      );
      await practica.cerrar();
      await contenedor.read(progresoProvider.future);

      expect(repositorio.consultas, 2);
    });
  });

  test('ProgresoModelo lee el JSON del contrato (HU-38)', () {
    final progreso = ProgresoModelo.progreso({
      'pruebas': [
        {
          'pruebaId': '2',
          'codigo': 'M1',
          'respondidas': 7,
          'acierto': 57.1,
          'aciertoPorDificultad': {'facil': 100, 'dificil': 33.3},
          'ejes': [
            {
              'id': '1',
              'nombre': 'Números',
              'respondidas': 7,
              'aciertoPonderado': 48.5,
              'aReforzar': true,
            },
          ],
          'habilidades': <Object?>[],
          'semanas': [
            {'semana': '2026-10-19', 'respondidas': 7, 'acierto': 57.1},
          ],
          'ensayos': [
            {
              'id': '9',
              'cerradaEn': '2026-10-18T15:00:00.000Z',
              'puntaje': 742,
            },
          ],
        },
      ],
    });

    final m1 = progreso.prueba(2)!;
    expect(m1.codigo, 'M1');
    expect(m1.porHabilidad, isFalse);
    expect(m1.aciertoPorDificultad, {'facil': 100.0, 'dificil': 33.3});
    expect(m1.grupos.single.aReforzar, isTrue);
    expect(m1.grupos.single.aciertoPonderado, 48.5);
    expect(m1.semanas.single.lunes, DateTime(2026, 10, 19));
    expect(m1.ensayos.single.puntaje, 742);
    expect(m1.ensayos.single.cerradaEn, DateTime.utc(2026, 10, 18, 15));
    expect(progreso.prueba(1), isNull);
  });
}
