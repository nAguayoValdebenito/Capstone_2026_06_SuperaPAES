import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:supera_paes/datos/modelos/practica_modelo.dart';
import 'package:supera_paes/dominio/entidades/practica.dart';
import 'package:supera_paes/nucleo/constantes.dart';
import 'package:supera_paes/nucleo/errores.dart';
import 'package:supera_paes/presentacion/comunes/componentes_seleccion.dart';
import 'package:supera_paes/presentacion/practicar/pantalla_resumen_practica.dart';

import 'apoyo/app_de_prueba.dart';
import 'apoyo/repositorio_cuentas_falso.dart';
import 'apoyo/repositorio_practica_falso.dart';

/// Abre Practicar con el perfil de ejemplo (Lectora, M1 a reforzar y
/// Ciencias con Biología, 3° medio).
Future<(ProviderContainer, RepositorioPracticaFalso)> _abrirPracticar(
  WidgetTester tester, {
  RepositorioPracticaFalso? practica,
}) async {
  final repositorio = practica ?? RepositorioPracticaFalso();
  final contenedor = crearContenedor(
    sesion: sesionDeEjemplo,
    practica: repositorio,
  );
  await iniciarApp(tester, contenedor, ruta: Rutas.practicar);
  return (contenedor, repositorio);
}

Finder _opcion(String texto) => find.widgetWithText(OpcionRadio, texto);

bool _marcada(WidgetTester tester, String texto) =>
    tester.widget<OpcionRadio>(_opcion(texto)).seleccionada;

ErrorApi _sinPreguntas(List<String> opciones) => ErrorApi(
  codigo: 'SIN_PREGUNTAS_SUFICIENTES',
  mensaje: 'No hay suficientes preguntas publicadas para lo elegido.',
  estadoHttp: 409,
  datos: {'disponibles': 4, 'solicitadas': 10, 'opciones': opciones},
);

void main() {
  group('Personaliza tu práctica (A13)', () {
    testWidgets('pide las opciones con el curso del perfil y elige la prueba '
        'a reforzar (esc. 1)', (tester) async {
      final (_, repositorio) = await _abrirPracticar(tester);

      expect(repositorio.cursos, ['3M']);
      final chips = tester
          .widgetList<ChipSeleccion>(find.byType(ChipSeleccion))
          .map((chip) => (chip.texto, chip.seleccionado));
      expect(chips, [
        ('M1 · reforzar', true),
        ('Lectora', false),
        ('Ciencias', false),
      ]);
      expect(_marcada(tester, 'Toda la prueba'), isTrue);
    });

    testWidgets('sin eje ni contenidos solo ofrece lo que la prueba tiene', (
      tester,
    ) async {
      await _abrirPracticar(tester);

      await tocar(tester, find.text('Lectora'));

      expect(_opcion('Toda la prueba'), findsOne);
      expect(_opcion('Una habilidad'), findsOne);
      expect(_opcion('Un eje'), findsNothing);
      expect(_opcion('Un contenido'), findsNothing);
    });

    testWidgets('la mezcla equilibrada viene de la base y se puede elegir una '
        'dificultad (esc. 2)', (tester) async {
      await _abrirPracticar(tester);
      expect(
        find.text('Mezcla equilibrada: 30 % fácil, 45 % media y 25 % difícil.'),
        findsOne,
      );

      await tocar(tester, find.text('Difícil'));

      expect(find.text('Solo preguntas de dificultad difícil.'), findsOne);
    });

    testWidgets('sugiere 10 preguntas y va de 5 a 20 (esc. 3)', (tester) async {
      final (contenedor, _) = await _abrirPracticar(tester);
      expect(find.text('10'), findsOne);
      expect(find.text('de 5 a 20'), findsOne);

      for (var i = 0; i < 7; i++) {
        await tocar(tester, find.byTooltip('Menos preguntas'));
      }
      expect(find.text('5'), findsOne);
      final menos = tester.widget<IconButton>(
        find.widgetWithIcon(IconButton, Icons.remove),
      );
      expect(menos.onPressed, isNull);

      for (var i = 0; i < 20; i++) {
        await tocar(tester, find.byTooltip('Más preguntas'));
      }
      expect(find.text('20'), findsOne);
      expect(rutaActual(contenedor), Rutas.practicar);
    });

    testWidgets('muestra las preguntas que quedan hoy', (tester) async {
      await _abrirPracticar(tester);

      expect(
        find.text('Hoy te quedan 8 preguntas: 3 del cupo diario y 5 extra.'),
        findsOne,
      );
    });

    testWidgets('«Empezar práctica» manda lo elegido y abre la pregunta', (
      tester,
    ) async {
      final (contenedor, repositorio) = await _abrirPracticar(tester);
      await tocar(tester, find.text('Fácil'));
      await tocar(tester, find.byTooltip('Más preguntas'));

      await tocar(tester, find.text('Empezar práctica'));

      final datos = repositorio.iniciadas.single;
      expect(PracticaModelo.datos(datos), {
        'pruebaId': 2,
        'dificultadId': 1,
        'cantidad': 11,
      });
      expect(rutaActual(contenedor), Rutas.pregunta);
    });

    testWidgets('sin cupo abre Cupo agotado; otro rechazo queda sobre el '
        'botón', (tester) async {
      final repositorio = RepositorioPracticaFalso()
        ..erroresAlIniciar.addAll(const [
          ErrorApi(
            codigo: 'EVALUACION_CON_TIEMPO_ABIERTA',
            mensaje: 'Termina tu evaluación con tiempo antes de empezar otra.',
          ),
          ErrorApi(codigo: 'CUPO_AGOTADO', mensaje: 'Sin cupo.'),
        ]);
      final (contenedor, _) = await _abrirPracticar(
        tester,
        practica: repositorio,
      );

      await tocar(tester, find.text('Empezar práctica'));
      expect(
        find.text('Termina tu evaluación con tiempo antes de empezar otra.'),
        findsOne,
      );

      await tocar(tester, find.text('Empezar práctica'));
      expect(rutaActual(contenedor), Rutas.cupoAgotado);
    });
  });

  group('Elegir eje, contenido o habilidad (A14)', () {
    testWidgets('lista los contenidos por eje, busca sin tildes y el elegido '
        'vuelve a A13', (tester) async {
      final (contenedor, repositorio) = await _abrirPracticar(tester);

      await tocar(tester, _opcion('Un contenido'));
      expect(rutaActual(contenedor), Rutas.elegirAlcance);
      expect(find.text('Contenidos de Matemática M1'), findsOne);
      expect(find.text('NÚMEROS'), findsOne);
      expect(find.text('ÁLGEBRA Y FUNCIONES'), findsOne);
      expect(
        find.textContaining('Ves los contenidos que se enseñan hasta 3° medio'),
        findsOne,
      );

      await tester.enterText(find.byType(TextField), 'RAICES');
      await tester.pumpAndSettle();
      expect(_opcion('Ecuaciones lineales'), findsNothing);

      await tocar(tester, _opcion('Potencias y raíces'));

      expect(rutaActual(contenedor), Rutas.practicar);
      expect(_marcada(tester, 'Un contenido'), isTrue);
      expect(find.text('Potencias y raíces'), findsOne);

      await tocar(tester, find.text('Empezar práctica'));
      expect(PracticaModelo.datos(repositorio.iniciadas.single), {
        'pruebaId': 2,
        'contenidoId': 101,
        'cantidad': 10,
      });
    });

    testWidgets('elegir un eje o una habilidad', (tester) async {
      final (contenedor, repositorio) = await _abrirPracticar(tester);

      await tocar(tester, _opcion('Un eje'));
      expect(find.text('Ejes de Matemática M1'), findsOne);
      await tocar(tester, _opcion('Álgebra y funciones'));
      await tocar(tester, _opcion('Una habilidad'));
      expect(find.text('Habilidades de Matemática M1'), findsOne);
      await tocar(tester, _opcion('Resolver problemas'));

      expect(rutaActual(contenedor), Rutas.practicar);
      await tocar(tester, find.text('Empezar práctica'));
      expect(
        PracticaModelo.datos(repositorio.iniciadas.single)['habilidadId'],
        20,
      );
    });

    testWidgets('cambiar de prueba vuelve a toda la prueba', (tester) async {
      await _abrirPracticar(tester);
      await tocar(tester, _opcion('Un eje'));
      await tocar(tester, _opcion('Números'));
      expect(_marcada(tester, 'Un eje'), isTrue);

      await tocar(tester, find.text('Ciencias'));

      expect(_marcada(tester, 'Toda la prueba'), isTrue);
    });
  });

  group('Sin preguntas suficientes (A15)', () {
    testWidgets('avisa, propone la mezcla y empieza con ella (esc. 4)', (
      tester,
    ) async {
      final repositorio = RepositorioPracticaFalso()
        ..erroresAlIniciar.add(_sinPreguntas(['usar_mezcla']));
      final (contenedor, _) = await _abrirPracticar(
        tester,
        practica: repositorio,
      );
      await tocar(tester, find.text('Difícil'));
      await tocar(tester, _opcion('Un contenido'));
      await tocar(tester, _opcion('Potencias y raíces'));

      await tocar(tester, find.text('Empezar práctica'));

      expect(rutaActual(contenedor), Rutas.sinPreguntas);
      expect(find.text('No hay suficientes preguntas'), findsOne);
      expect(
        find.textContaining(
          'Por ahora no hay 10 preguntas difíciles de Potencias y raíces',
          findRichText: true,
        ),
        findsOne,
      );
      expect(find.text('Practicar toda la prueba Matemática M1'), findsNothing);

      await tocar(tester, find.text('Usar la mezcla de dificultad'));

      expect(repositorio.iniciadas.last.dificultadId, isNull);
      expect(repositorio.iniciadas.last.alcance.id, 101);
      expect(rutaActual(contenedor), Rutas.pregunta);
    });

    testWidgets('ampliar a toda la prueba y «Elegir otra cosa»', (
      tester,
    ) async {
      final repositorio = RepositorioPracticaFalso()
        ..erroresAlIniciar.addAll([
          _sinPreguntas(['ampliar_alcance']),
          _sinPreguntas(['ampliar_alcance']),
        ]);
      final (contenedor, _) = await _abrirPracticar(
        tester,
        practica: repositorio,
      );
      await tocar(tester, _opcion('Un eje'));
      await tocar(tester, _opcion('Números'));
      await tocar(tester, find.text('Empezar práctica'));
      expect(find.text('Usar la mezcla de dificultad'), findsNothing);

      await tocar(tester, find.text('Elegir otra cosa'));
      expect(rutaActual(contenedor), Rutas.practicar);

      await tocar(tester, find.text('Empezar práctica'));
      await tocar(tester, find.text('Practicar toda la prueba Matemática M1'));

      expect(repositorio.iniciadas.last.alcance.tipo, TipoAlcance.prueba);
      expect(rutaActual(contenedor), Rutas.pregunta);
    });
  });

  group('Resumen de la práctica (A21)', () {
    testWidgets('al terminar muestra aciertos, incorrectas y tiempo (esc. 5)', (
      tester,
    ) async {
      final (contenedor, _) = await _abrirPracticar(tester);
      await tocar(tester, find.text('Empezar práctica'));

      await tocar(tester, find.textContaining('Terminar práctica'));

      expect(rutaActual(contenedor), Rutas.resumenPractica);
      expect(find.text('Práctica terminada'), findsOne);
      expect(find.text('Matemática M1 · Potencias y raíces'), findsOne);
      expect(find.text('Mezcla de dificultad · 10 preguntas'), findsOne);
      expect(find.text('7/10'), findsOne);
      expect(find.text('70 % de acierto'), findsOne);
      expect(find.text('12 min'), findsOne);
      expect(
        find.textContaining(
          'Las 3 incorrectas pasaron a Repasar errores. La práctica quedó en '
          'tu historial.',
          findRichText: true,
        ),
        findsOne,
      );

      await tocar(tester, find.text('Volver al inicio'));
      expect(rutaActual(contenedor), Rutas.inicio);
    });

    test('el tiempo va en minutos, o en segundos si fue menos de uno', () {
      expect(tiempoDePractica(45), '45 s');
      expect(tiempoDePractica(720), '12 min');
    });
  });

  group('PracticaModelo', () {
    test('manda un solo alcance y, sin dificultad, la mezcla', () {
      expect(
        PracticaModelo.datos(
          const DatosPractica(
            pruebaId: 3,
            alcance: Alcance(TipoAlcance.eje, id: 9, nombre: 'Números'),
            dificultadId: null,
            cantidad: 5,
          ),
        ),
        {'pruebaId': 3, 'ejeId': 9, 'cantidad': 5},
      );
    });

    test('lee el resumen con el nombre de la prueba como en Inicio', () {
      final resumen = PracticaModelo.resumen({
        'id': 41,
        'prueba': {
          'id': 3,
          'codigo': 'M2',
          'nombre': 'Competencia Matemática 2',
        },
        'alcance': {'tipo': 'contenido', 'id': 120, 'nombre': 'Logaritmos'},
        'dificultad': {'id': null, 'codigo': 'mezcla', 'nombre': 'Mezcla'},
        'cantidad': 10,
        'respondidas': 10,
        'correctas': 7,
        'incorrectas': 3,
        'omitidas': 0,
        'porcentaje': 70,
        'tiempoUsadoSeg': 720,
        'ejes': <Object>[],
        'habilidades': <Object>[],
      });

      expect(resumen.prueba, 'Matemática M2');
      expect(resumen.alcance.nombre, 'Logaritmos');
      expect(resumen.porcentaje, 70.0);
    });
  });
}
