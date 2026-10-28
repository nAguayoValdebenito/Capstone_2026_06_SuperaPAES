import 'package:flutter/material.dart';
import 'package:flutter_math_fork/flutter_math.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:supera_paes/datos/modelos/practica_modelo.dart';
import 'package:supera_paes/dominio/entidades/practica.dart';
import 'package:supera_paes/nucleo/constantes.dart';
import 'package:supera_paes/nucleo/errores.dart';
import 'package:supera_paes/presentacion/comunes/componentes_seleccion.dart';
import 'package:supera_paes/presentacion/comunes/formato_pregunta_vista.dart';

import 'apoyo/app_de_prueba.dart';
import 'apoyo/repositorio_cuentas_falso.dart';
import 'apoyo/repositorio_practica_falso.dart';

/// Empieza una práctica de M1 (la prueba a reforzar del perfil de ejemplo)
/// con la mezcla y abre su primera pregunta. Con `restar`, quita preguntas a
/// las 10 sugeridas.
Future<ProviderContainer> _empezar(
  WidgetTester tester,
  RepositorioPracticaFalso repositorio, {
  int restar = 0,
}) async {
  final contenedor = crearContenedor(
    sesion: sesionDeEjemplo,
    practica: repositorio,
  );
  await iniciarApp(tester, contenedor, ruta: Rutas.practicar);
  for (var i = 0; i < restar; i++) {
    await tocar(tester, find.byTooltip('Menos preguntas'));
  }
  await tocar(tester, find.text('Empezar práctica'));
  return contenedor;
}

Finder _alternativa(String letra) => find.byWidgetPredicate(
  (widget) => widget is OpcionAlternativa && widget.letra == letra,
);

bool _elegida(WidgetTester tester, String letra) =>
    tester.widget<OpcionAlternativa>(_alternativa(letra)).seleccionada;

FilledButton _boton(WidgetTester tester, String texto) =>
    tester.widget<FilledButton>(find.widgetWithText(FilledButton, texto));

void main() {
  group('Pregunta de práctica (A17)', () {
    testWidgets('muestra lo que se practica, el avance, lo que queda hoy y '
        'las alternativas', (tester) async {
      final contenedor = await _empezar(tester, RepositorioPracticaFalso());

      expect(rutaActual(contenedor), Rutas.pregunta);
      expect(find.text('Terminar'), findsOne);
      expect(
        find.textContaining('Hoy te quedan 8', findRichText: true),
        findsOne,
      );
      expect(find.text('M1 · Mezcla'), findsOne);
      expect(find.text('Pregunta 1 de 10'), findsOne);
      expect(find.text('Si log2(x) = 5, ¿cuál es el valor de x?'), findsOne);
      expect(find.byType(OpcionAlternativa), findsNWidgets(4));
      expect(_boton(tester, 'Responder').onPressed, isNull);
    });

    testWidgets('responde la elegida, muestra la corrección y sigue con la '
        'siguiente', (tester) async {
      final repositorio = RepositorioPracticaFalso();
      final contenedor = await _empezar(tester, repositorio);

      await tocar(tester, _alternativa('B'));
      await tocar(tester, _alternativa('C'));
      expect(_elegida(tester, 'C'), isTrue);
      expect(_elegida(tester, 'B'), isFalse);
      await tocar(tester, find.text('Responder'));

      expect(repositorio.respuestas, [(1001, 12)]);
      expect(rutaActual(contenedor), Rutas.correccion);
      expect(find.text('Respuesta correcta.'), findsOne);
      expect(find.text('Si log2(x) = 5, entonces x = 2⁵ = 32.'), findsOne);

      await tocar(tester, find.text('Siguiente pregunta'));

      expect(rutaActual(contenedor), Rutas.pregunta);
      expect(find.text('Pregunta 2 de 10'), findsOne);
      expect(_elegida(tester, 'C'), isFalse);
    });

    testWidgets('después de la última pregunta lleva al resumen', (
      tester,
    ) async {
      final repositorio = RepositorioPracticaFalso();
      final contenedor = await _empezar(tester, repositorio, restar: 5);

      for (var orden = 1; orden <= 5; orden++) {
        expect(find.text('Pregunta $orden de 5'), findsOne);
        await tocar(tester, _alternativa('A'));
        await tocar(tester, find.text('Responder'));
        expect(find.text('Respuesta incorrecta.'), findsOne);
        if (orden < 5) await tocar(tester, find.text('Siguiente pregunta'));
      }

      await tocar(tester, find.text('Ver resumen'));
      expect(rutaActual(contenedor), Rutas.resumenPractica);
      expect(repositorio.respuestas, hasLength(5));
    });

    testWidgets('«Terminar» pide confirmar: se puede seguir o cerrar', (
      tester,
    ) async {
      final contenedor = await _empezar(tester, RepositorioPracticaFalso());

      await tocar(tester, find.text('Terminar'));
      expect(find.text('¿Terminar la práctica?'), findsOne);
      await tester.tap(find.text('Seguir practicando'));
      await tester.pumpAndSettle();
      expect(rutaActual(contenedor), Rutas.pregunta);

      await tocar(tester, find.text('Terminar'));
      await tester.tap(find.widgetWithText(TextButton, 'Terminar').last);
      await tester.pumpAndSettle();
      expect(rutaActual(contenedor), Rutas.resumenPractica);
    });

    testWidgets('si responder falla, el mensaje queda sobre el botón', (
      tester,
    ) async {
      final repositorio = RepositorioPracticaFalso()
        ..errorAlResponder = const ErrorApi(
          codigo: 'RESPUESTA_YA_REGISTRADA',
          mensaje: 'Ya respondiste esta pregunta.',
        );
      final contenedor = await _empezar(tester, repositorio);

      await tocar(tester, _alternativa('A'));
      await tocar(tester, find.text('Responder'));

      expect(find.text('Ya respondiste esta pregunta.'), findsOne);
      expect(rutaActual(contenedor), Rutas.pregunta);
    });

    testWidgets('sin cupo para la siguiente ofrece ver cómo seguir', (
      tester,
    ) async {
      final repositorio = RepositorioPracticaFalso()
        ..errorAlSiguiente = const ErrorApi(
          codigo: 'CUPO_AGOTADO',
          mensaje:
              'Ya usaste tus preguntas de hoy y no te quedan preguntas extra.',
        );
      final contenedor = await _empezar(tester, repositorio);

      expect(
        find.text(
          'Ya usaste tus preguntas de hoy y no te quedan preguntas extra.',
        ),
        findsOne,
      );
      await tocar(tester, find.text('Ver cómo seguir'));
      expect(rutaActual(contenedor), Rutas.cupoAgotado);
    });

    testWidgets('sin práctica en curso invita a elegir una', (tester) async {
      final contenedor = crearContenedor(sesion: sesionDeEjemplo);
      await iniciarApp(tester, contenedor, ruta: Rutas.pregunta);

      expect(find.text('No tienes una práctica en curso'), findsOne);
      await tocar(tester, find.text('Elegir práctica'));
      expect(rutaActual(contenedor), Rutas.practicar);
    });
  });

  group('Pregunta con texto de lectura (A20)', () {
    const texto = TextoDeLectura(
      titulo: 'Texto 1 · No literario',
      contenido:
          'Las ciudades costeras de Chile enfrentan marejadas cada vez más '
          'frecuentes.',
    );

    testWidgets('muestra el texto antes de la pregunta y «Ampliar texto» lo '
        'abre entero sin perder la alternativa elegida (esc. 1)', (
      tester,
    ) async {
      await _empezar(tester, RepositorioPracticaFalso(texto: texto));
      expect(find.text('TEXTO 1 · NO LITERARIO'), findsOne);
      expect(find.text(texto.contenido!), findsOne);
      await tocar(tester, _alternativa('B'));

      await tocar(tester, find.text('Ampliar texto'));
      expect(find.text('Volver a la pregunta'), findsOne);
      expect(find.text('Texto 1 · No literario'), findsOne);

      await tocar(tester, find.text('Volver a la pregunta'));
      expect(_elegida(tester, 'B'), isTrue);
    });
  });

  group('Fórmulas e imágenes en la pregunta (HU-34.2)', () {
    testWidgets('el enunciado y las alternativas dibujan sus fórmulas', (
      tester,
    ) async {
      await _empezar(
        tester,
        RepositorioPracticaFalso(
          enunciado: r'Si $\log_2(x) = 5$, ¿cuál es el valor de $x$?',
          textosAlternativas: const [
            r'$10$',
            r'$25$',
            r'$2^5$',
            r'$\frac{5}{2}$',
          ],
        ),
      );

      // Dos en el enunciado y una en cada alternativa.
      expect(find.byType(Math), findsNWidgets(6));
      expect(find.byType(OpcionAlternativa), findsNWidgets(4));
    });

    testWidgets('el texto de lectura muestra su imagen, que se puede '
        'agrandar (esc. 3)', (tester) async {
      await _empezar(
        tester,
        RepositorioPracticaFalso(
          texto: const TextoDeLectura(
            titulo: 'Gráfico 1',
            contenido: 'Ventas de una tienda durante el año.',
            imagen: '/archivos/grafico-1.png',
          ),
        ),
      );

      await tocar(tester, find.byType(ImagenAmpliable));
      expect(find.byType(PantallaImagen), findsOne);
      await tester.tap(find.byTooltip('Volver a la pregunta'));
      await tester.pumpAndSettle();
      expect(find.text('Pregunta 1 de 10'), findsOne);
    });
  });

  group('PracticaModelo de la pregunta', () {
    test('lee la pregunta con su texto y los ids como números', () {
      final pregunta = PracticaModelo.pregunta({
        'id': '84',
        'orden': 2,
        'total': 5,
        'enunciado': '¿Por qué los autores prefieren restaurar las dunas?',
        'texto': {
          'titulo': 'Texto 1',
          'contenido': 'Las ciudades costeras…',
          'imagen': null,
        },
        'alternativas': [
          {'id': '301', 'letra': 'A', 'texto': 'Son más baratas.'},
          {'id': 302, 'letra': 'B', 'texto': 'Los muros desplazan la erosión.'},
        ],
      });

      expect(pregunta.itemId, 84);
      expect(pregunta.texto?.titulo, 'Texto 1');
      expect(pregunta.alternativas.map((a) => a.id), [301, 302]);
      expect(pregunta.esLaUltima, isFalse);
    });

    test('una pregunta sin texto no trae texto de lectura', () {
      final pregunta = PracticaModelo.pregunta({
        'id': 1,
        'orden': 5,
        'total': 5,
        'enunciado': 'Si log2(x) = 5, ¿cuál es el valor de x?',
        'texto': null,
        'alternativas': <Object>[],
      });

      expect(pregunta.texto, isNull);
      expect(pregunta.esLaUltima, isTrue);
    });

    test('lee la corrección', () {
      final correccion = PracticaModelo.correccion({
        'esCorrecta': false,
        'alternativaElegidaId': '301',
        'alternativaCorrectaId': 302,
        'explicacion': 'Los muros trasladan el problema.',
        'alternativas': <Object>[],
        'cupo': <String, Object>{},
      });

      expect(correccion.esCorrecta, isFalse);
      expect(correccion.alternativaElegidaId, 301);
      expect(correccion.alternativaCorrectaId, 302);
    });
  });
}
