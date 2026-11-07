import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:supera_paes/nucleo/tema.dart';
import 'package:supera_paes/presentacion/comunes/barra_inferior.dart';

final ThemeData _tema = TemaSuperaPaes.claro;

Widget _marco({
  int seleccionada = 0,
  bool reducida = false,
  double escala = 1,
  ValueChanged<int>? alSeleccionar,
}) => MaterialApp(
  theme: _tema,
  home: MediaQuery(
    data: MediaQueryData(
      disableAnimations: reducida,
      textScaler: TextScaler.linear(escala),
    ),
    child: Scaffold(
      bottomNavigationBar: BarraInferior(
        seleccionada: seleccionada,
        alSeleccionar: alSeleccionar ?? (_) {},
      ),
    ),
  ),
);

double _posicion(WidgetTester tester) => tester
    .widget<Transform>(find.byKey(const ValueKey('indicador-pestana')))
    .transform
    .storage[12];

void main() {
  for (final ancho in [320.0, 360.0, 390.0]) {
    testWidgets('etiquetas completas de una línea a 2,0 en $ancho dp', (
      tester,
    ) async {
      tester.view.physicalSize = Size(ancho, 640);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.reset);
      await tester.pumpWidget(_marco(escala: 2));
      const etiquetas = [
        'Inicio',
        'Practicar',
        'Evaluaciones',
        'Progreso',
        'Perfil',
      ];
      for (final etiqueta in etiquetas) {
        final texto = tester.widget<Text>(find.text(etiqueta));
        expect(texto.maxLines, 1);
        expect(texto.softWrap, isFalse);
        final contexto = tester.element(find.text(etiqueta));
        expect(MediaQuery.textScalerOf(contexto).scale(10), 13);
        expect(
          tester
              .getSize(
                find.byKey(ValueKey('pestana-${etiquetas.indexOf(etiqueta)}')),
              )
              .height,
          greaterThanOrEqualTo(TemaSuperaPaes.zonaTactil),
        );
      }
      expect(tester.takeException(), isNull);
    });
  }

  testWidgets('expone selección y acción sin depender del color', (
    tester,
  ) async {
    var elegida = -1;
    await tester.pumpWidget(
      _marco(seleccionada: 2, alSeleccionar: (i) => elegida = i),
    );
    final semantica = tester.ensureSemantics();
    try {
      expect(
        tester.getSemantics(find.byKey(const ValueKey('pestana-2'))),
        matchesSemantics(
          label: 'Evaluaciones',
          isButton: true,
          isSelected: true,
          hasSelectedState: true,
          hasTapAction: true,
        ),
      );
      await tester.tap(find.text('Perfil'));
      expect(elegida, 4);
    } finally {
      semantica.dispose();
    }
  });

  testWidgets('la píldora se traslada y el pulso termina', (tester) async {
    await tester.pumpWidget(_marco());
    expect(_posicion(tester), 0);
    await tester.pumpWidget(_marco(seleccionada: 2));
    await tester.pump(const Duration(milliseconds: 100));
    final mitad = _posicion(tester);
    expect(mitad, greaterThan(0));
    expect(
      mitad,
      lessThan(tester.getSize(find.byType(BarraInferior)).width / 5 * 2),
    );
    final escala = find.descendant(
      of: find.byKey(const ValueKey('pestana-2')),
      matching: find.byType(Transform),
    );
    expect(
      tester.widget<Transform>(escala).transform.storage[0],
      greaterThan(1),
    );
    await tester.pumpAndSettle();
    expect(
      _posicion(tester),
      closeTo(tester.getSize(find.byType(BarraInferior)).width / 5 * 2, 0.01),
    );
    expect(
      tester.widget<Transform>(escala).transform.storage[0],
      closeTo(1, 0.001),
    );
  });

  testWidgets('movimiento reducido llega al destino en el primer cuadro', (
    tester,
  ) async {
    await tester.pumpWidget(_marco(reducida: true));
    await tester.pumpAndSettle();
    await tester.pumpWidget(_marco(seleccionada: 4, reducida: true));
    expect(
      _posicion(tester),
      closeTo(tester.getSize(find.byType(BarraInferior)).width / 5 * 4, 0.01),
    );
    expect(tester.binding.hasScheduledFrame, isFalse);
    expect(tester.takeException(), isNull);
  });

  testWidgets('desmontar la barra durante el pulso libera el controlador', (
    tester,
  ) async {
    await tester.pumpWidget(_marco());
    await tester.pumpWidget(_marco(seleccionada: 1));
    await tester.pump(const Duration(milliseconds: 25));
    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
  });
}
