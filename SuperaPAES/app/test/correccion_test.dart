import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:supera_paes/datos/modelos/practica_modelo.dart';
import 'package:supera_paes/nucleo/constantes.dart';
import 'package:supera_paes/presentacion/comunes/componentes_seleccion.dart';

import 'apoyo/app_de_prueba.dart';
import 'apoyo/repositorio_cuentas_falso.dart';
import 'apoyo/repositorio_practica_falso.dart';

/// Empieza una práctica de M1 y abre su primera pregunta (A17).
Future<ProviderContainer> _empezar(
  WidgetTester tester,
  RepositorioPracticaFalso repositorio,
) async {
  final contenedor = crearContenedor(
    sesion: sesionDeEjemplo,
    practica: repositorio,
  );
  await iniciarApp(tester, contenedor, ruta: Rutas.practicar);
  await tocar(tester, find.text('Empezar práctica'));
  return contenedor;
}

Finder _alternativa(String letra) => find.byWidgetPredicate(
  (widget) => widget is OpcionAlternativa && widget.letra == letra,
);

OpcionAlternativa _opcion(WidgetTester tester, String letra) =>
    tester.widget<OpcionAlternativa>(_alternativa(letra));

/// Elige la alternativa, toca «Responder» y confirma en A18.
Future<void> _responderCon(WidgetTester tester, String letra) async {
  await tocar(tester, _alternativa(letra));
  await tocar(tester, find.text('Responder'));
  await tester.tap(find.text('Confirmar'));
  await tester.pumpAndSettle();
}

void main() {
  group('Confirmar respuesta (A18)', () {
    testWidgets('avisa que la respuesta es definitiva antes de enviarla '
        '(esc. 4)', (tester) async {
      final repositorio = RepositorioPracticaFalso();
      await _empezar(tester, repositorio);

      await tocar(tester, _alternativa('C'));
      await tocar(tester, find.text('Responder'));

      expect(find.text('¿Confirmas la alternativa C?'), findsOne);
      expect(
        find.text(
          'En la práctica la corrección es inmediata, así que después no '
          'podrás cambiarla.',
        ),
        findsOne,
      );
      expect(repositorio.respuestas, isEmpty);
    });

    testWidgets('«Cambiar alternativa» vuelve sin enviar y se puede elegir '
        'otra', (tester) async {
      final repositorio = RepositorioPracticaFalso();
      final contenedor = await _empezar(tester, repositorio);
      await tocar(tester, _alternativa('C'));
      await tocar(tester, find.text('Responder'));

      await tester.tap(find.text('Cambiar alternativa'));
      await tester.pumpAndSettle();

      expect(repositorio.respuestas, isEmpty);
      expect(rutaActual(contenedor), Rutas.pregunta);
      expect(_opcion(tester, 'C').seleccionada, isTrue);

      await _responderCon(tester, 'B');
      expect(repositorio.respuestas, [(1001, 11)]);
    });
  });

  group('Corrección con explicación (A19 y A19b)', () {
    testWidgets('acertada: la correcta en verde con «Tu respuesta» y la '
        'explicación (esc. 2)', (tester) async {
      await _empezar(tester, RepositorioPracticaFalso());

      await _responderCon(tester, 'C');

      expect(find.text('Respuesta correcta'), findsOne);
      final correcta = _opcion(tester, 'C');
      expect(correcta.resultado, ResultadoAlternativa.correcta);
      expect(correcta.etiqueta, 'Tu respuesta');
      expect(_opcion(tester, 'A').resultado, isNull);
      expect(find.text('Explicación'), findsOne);
      expect(find.text('Si log2(x) = 5, entonces x = 2⁵ = 32.'), findsOne);
      expect(find.textContaining('Por qué la'), findsNothing);
      expect(find.text('Siguiente pregunta'), findsOne);
    });

    testWidgets('fallada: la elegida en rojo, la correcta marcada y por qué '
        'la elegida no es correcta', (tester) async {
      await _empezar(tester, RepositorioPracticaFalso());

      await _responderCon(tester, 'B');

      expect(find.text('Respuesta incorrecta'), findsOne);
      final elegida = _opcion(tester, 'B');
      expect(elegida.resultado, ResultadoAlternativa.incorrecta);
      expect(elegida.etiqueta, 'Tu respuesta');
      final correcta = _opcion(tester, 'C');
      expect(correcta.resultado, ResultadoAlternativa.correcta);
      expect(correcta.etiqueta, 'Correcta');
      expect(find.text('Por qué la B no es correcta'), findsOne);
      expect(find.text('La B no cumple que log2(x) = 5.'), findsOne);
    });

    testWidgets('las alternativas ya no se pueden cambiar (esc. 4)', (
      tester,
    ) async {
      final repositorio = RepositorioPracticaFalso();
      await _empezar(tester, repositorio);

      await _responderCon(tester, 'B');

      for (final letra in ['A', 'B', 'C', 'D']) {
        expect(_opcion(tester, letra).onTap, isNull);
      }
      await tester.tap(_alternativa('C'));
      await tester.pumpAndSettle();
      expect(repositorio.respuestas, hasLength(1));
    });

    testWidgets('sin respuesta para revisar, invita a ir a Practicar', (
      tester,
    ) async {
      final contenedor = crearContenedor(sesion: sesionDeEjemplo);
      await iniciarApp(tester, contenedor, ruta: Rutas.correccion);

      expect(find.text('No hay una respuesta para revisar'), findsOne);
      await tocar(tester, find.text('Ir a Practicar'));
      expect(rutaActual(contenedor), Rutas.practicar);
    });
  });

  test('PracticaModelo lee la explicación de cada alternativa', () {
    final correccion = PracticaModelo.correccion({
      'esCorrecta': false,
      'alternativaElegidaId': '301',
      'alternativaCorrectaId': 302,
      'explicacion': 'Los muros trasladan el problema.',
      'alternativas': [
        {
          'id': '301',
          'letra': 'A',
          'texto': 'Son más baratas.',
          'explicacion': 'El texto no habla de costos.',
        },
        {
          'id': 302,
          'letra': 'B',
          'texto': 'Los muros desplazan la erosión.',
          'explicacion': null,
        },
      ],
      'cupo': <String, Object>{},
    });

    expect(correccion.alternativas.map((a) => a.id), [301, 302]);
    expect(correccion.elegida?.explicacion, 'El texto no habla de costos.');
  });
}
