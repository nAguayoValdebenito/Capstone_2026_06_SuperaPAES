import 'package:flutter/material.dart';
import 'package:flutter_math_fork/flutter_math.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:supera_paes/nucleo/configuracion.dart';
import 'package:supera_paes/nucleo/tema.dart';
import 'package:supera_paes/presentacion/comunes/formato_pregunta.dart';
import 'package:supera_paes/presentacion/comunes/formato_pregunta_vista.dart';

/// Monta un widget con el tema de la app, en el teléfono de referencia.
Future<void> _montar(WidgetTester tester, Widget hijo) async {
  tester.view.physicalSize = const Size(390, 844);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(
    MaterialApp(
      theme: TemaSuperaPaes.claro,
      home: Scaffold(
        body: Padding(padding: const EdgeInsets.all(24), child: hijo),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

/// Los trozos como texto legible: «t:…» para texto, «f:…» para fórmulas,
/// con «*» si es cursiva y «**» si es negrita.
List<String> _trozos(String texto) => [
  for (final trozo in trozosDeTexto(texto))
    switch (trozo) {
      TextoPregunta(:final texto, :final negrita, :final cursiva) =>
        't:${negrita ? '**' : ''}${cursiva ? '*' : ''}$texto',
      FormulaEnLinea(:final tex) => 'f:$tex',
    },
];

void main() {
  group('trozosDeTexto', () {
    test('separa las fórmulas en línea y la cursiva (A17)', () {
      expect(_trozos(r'Si $\log_2(x) = 5$, ¿cuál es el valor de *x*?'), [
        't:Si ',
        r'f:\log_2(x) = 5',
        't:, ¿cuál es el valor de ',
        't:*x',
        't:?',
      ]);
    });

    test(r'un precio en pesos no es una fórmula: «$5.000 y $3.000»', () {
      expect(_trozos(r'Pagó $5.000 y luego $3.000.'), [
        r't:Pagó $5.000 y luego $3.000.',
      ]);
      expect(_trozos(r'Costó $ 300 en total'), [r't:Costó $ 300 en total']);
    });

    test(r'\$ es un signo peso dentro del texto', () {
      expect(_trozos(r'Ahorra \$500 al mes y gasta $x$'), [
        r't:Ahorra $500 al mes y gasta ',
        'f:x',
      ]);
    });

    test('la negrita y un asterisco suelto', () {
      expect(_trozos('**Importante:** lee 2 * 3 con calma'), [
        't:**Importante:',
        't: lee 2 * 3 con calma',
      ]);
    });
  });

  group('bloquesDePregunta', () {
    test(r'una fórmula $$…$$ va en su propia línea, aunque ocupe varias', () {
      final bloques = bloquesDePregunta(
        'Resuelve:\n\$\$x^2\n= 4\$\$\nElige la alternativa correcta.',
      );

      expect(bloques, hasLength(3));
      expect(bloques[1], isA<FormulaEnBloque>());
      expect((bloques[1] as FormulaEnBloque).tex, 'x^2\n= 4');
    });

    test('una imagen separa el párrafo y guarda su texto alternativo', () {
      final bloques = bloquesDePregunta(
        'Observa el gráfico:\n![Ventas por mes](https://ejemplo.cl/v.png)\n'
        '¿En qué mes se vendió más?',
      );

      expect(bloques.map((b) => b.runtimeType), [
        ParrafoPregunta,
        ImagenPregunta,
        ParrafoPregunta,
      ]);
      final imagen = bloques[1] as ImagenPregunta;
      expect(imagen.url, 'https://ejemplo.cl/v.png');
      expect(imagen.alternativo, 'Ventas por mes');
    });

    test('los saltos de línea de un párrafo se conservan (I, II y III)', () {
      final bloques = bloquesDePregunta('I. Es par.\nII. Es primo.');

      final parrafo = bloques.single as ParrafoPregunta;
      expect(
        (parrafo.trozos.single as TextoPregunta).texto,
        'I. Es par.\nII. Es primo.',
      );
    });
  });

  group('TextoConFormulas (HU-34 esc. 2 y 3)', () {
    testWidgets('dibuja las fórmulas en línea y solas con LaTeX', (
      tester,
    ) async {
      await _montar(
        tester,
        const TextoConFormulas(
          r'Si $\frac{x}{2} = 4$, entonces:'
          '\n\n'
          r'$$x = 8$$',
        ),
      );

      expect(find.byType(Math), findsNWidgets(2));
      expect(
        find.textContaining('entonces:', findRichText: true),
        findsOneWidget,
      );
      // El lector de pantalla lee el LaTeX de cada fórmula.
      expect(
        find.byWidgetPredicate(
          (widget) =>
              widget is Semantics &&
              widget.properties.label == r'\frac{x}{2} = 4',
        ),
        findsOne,
      );
    });

    testWidgets('una fórmula mal escrita se muestra tal cual', (tester) async {
      await _montar(tester, const TextoConFormulas(r'Mal: $\frac{1}{$ fin'));

      expect(find.text(r'$\frac{1}{$'), findsOne);
    });

    testWidgets('la imagen se agranda en pantalla completa y se cierra', (
      tester,
    ) async {
      await _montar(
        tester,
        const TextoConFormulas('![Ventas por mes](https://ejemplo.cl/v.png)'),
      );
      // Sin red en las pruebas, la imagen muestra su texto alternativo.
      expect(
        find.text('No se pudo cargar la imagen: Ventas por mes'),
        findsOne,
      );

      await tester.tap(find.byType(ImagenAmpliable));
      await tester.pumpAndSettle();
      expect(find.byType(PantallaImagen), findsOne);
      expect(find.byType(InteractiveViewer), findsOne);

      await tester.tap(find.byTooltip('Volver a la pregunta'));
      await tester.pumpAndSettle();
      expect(find.byType(PantallaImagen), findsNothing);
    });

    test('una imagen con dirección relativa se pide a la API', () {
      expect(
        direccionDeImagen('/archivos/v.png'),
        '${Configuracion.apiUrl}/archivos/v.png',
      );
      expect(
        direccionDeImagen('https://ejemplo.cl/v.png'),
        'https://ejemplo.cl/v.png',
      );
    });
  });
}
