import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:supera_paes/nucleo/errores.dart';
import 'package:supera_paes/nucleo/tema.dart';
import 'package:supera_paes/presentacion/comunes/estados.dart';

Future<void> _mostrar(WidgetTester tester, Widget hijo) => tester.pumpWidget(
  MaterialApp(
    theme: TemaSuperaPaes.claro,
    home: Scaffold(body: ListView(children: [hijo])),
  ),
);

/// Estados de carga, vacío y error del plan de mejora visual (tanda A).
void main() {
  group('EstadoError', () {
    testWidgets('muestra el mensaje de la API y reintenta', (tester) async {
      var reintentos = 0;
      await _mostrar(
        tester,
        EstadoError(
          error: const ErrorApi(
            codigo: 'SIN_CONEXION',
            mensaje:
                'Sin conexión por ahora. Revisa tu internet e '
                'inténtalo de nuevo.',
          ),
          mensaje: 'No pudimos cargar tu progreso.',
          alReintentar: () => reintentos++,
        ),
      );

      expect(find.textContaining('Sin conexión por ahora'), findsOne);
      expect(find.text('No pudimos cargar tu progreso.'), findsNothing);
      await tester.tap(find.text('Reintentar'));
      expect(reintentos, 1);
    });

    testWidgets('con un error que no es de la API, muestra el texto general', (
      tester,
    ) async {
      await _mostrar(
        tester,
        EstadoError(
          error: StateError('falla interna'),
          mensaje: 'No pudimos cargar tu progreso.',
          alReintentar: () {},
        ),
      );

      expect(find.text('No pudimos cargar tu progreso.'), findsOne);
      expect(find.textContaining('falla interna'), findsNothing);
    });
  });

  testWidgets('EstadoVacio muestra su botón solo con una acción', (
    tester,
  ) async {
    var tocado = false;
    await _mostrar(
      tester,
      EstadoVacio(
        titulo: 'Aún no hay respuestas',
        texto: 'Practica y aquí verás tu avance.',
        accion: 'Practicar',
        alTocar: () => tocado = true,
      ),
    );
    await tester.tap(find.text('Practicar'));
    expect(tocado, isTrue);

    await _mostrar(
      tester,
      const EstadoVacio(titulo: 'Muy pronto', texto: 'Llega con la HU-39.'),
    );
    expect(find.byType(FilledButton), findsNothing);
  });

  testWidgets('el esqueleto no se mueve si el teléfono pide reducir el '
      'movimiento', (tester) async {
    await tester.pumpWidget(
      const MediaQuery(
        data: MediaQueryData(disableAnimations: true),
        child: Directionality(
          textDirection: TextDirection.ltr,
          child: EsqueletoTarjeta(),
        ),
      ),
    );
    // Sin animación continua, la pantalla queda quieta enseguida.
    await tester.pumpAndSettle();
    expect(find.bySemanticsLabel('Cargando'), findsOne);
  });
}
