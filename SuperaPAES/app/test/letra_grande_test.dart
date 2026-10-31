import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:supera_paes/nucleo/constantes.dart';
import 'package:supera_paes/presentacion/comunes/componentes_seleccion.dart';

import 'apoyo/app_de_prueba.dart';
import 'apoyo/repositorio_cuentas_falso.dart';
import 'apoyo/repositorio_practica_falso.dart';

/// Recorre la pantalla hasta abajo: un desborde se avisa al dibujar cada
/// parte, y la lista solo dibuja lo que se ve.
Future<void> _recorrer(WidgetTester tester) async {
  for (var i = 0; i < 8; i++) {
    await tester.drag(find.byType(Scrollable).first, const Offset(0, -400));
    await tester.pumpAndSettle();
  }
  expect(tester.takeException(), isNull);
}

void main() {
  // CP-41 (RNF-12): con la letra del teléfono al doble, la práctica se
  // recorre entera sin que nada se desborde ni se corte.
  testWidgets('la práctica se recorre con la letra al doble (RNF-12): A13, '
      'A17, A18, A19 y A21', (tester) async {
    tester.platformDispatcher.textScaleFactorTestValue = 2;
    addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
    final contenedor = crearContenedor(
      sesion: sesionDeEjemplo,
      practica: RepositorioPracticaFalso(),
    );

    await iniciarApp(tester, contenedor, ruta: Rutas.practicar);
    await _recorrer(tester);

    await tocar(tester, find.text('Empezar práctica'));
    expect(rutaActual(contenedor), Rutas.pregunta);
    await _recorrer(tester);

    await tocar(
      tester,
      find.byWidgetPredicate((w) => w is OpcionAlternativa && w.letra == 'C'),
    );
    await tocar(tester, find.text('Responder'));
    // La hoja de A18 también tiene que caber.
    expect(tester.takeException(), isNull);
    await tester.tap(find.text('Confirmar'));
    await tester.pumpAndSettle();
    expect(rutaActual(contenedor), Rutas.correccion);
    await _recorrer(tester);

    // A19 sigue a la pregunta siguiente; la práctica se termina desde A17.
    await tocar(tester, find.text('Siguiente pregunta'));
    await tocar(tester, find.text('Terminar'));
    await tester.tap(find.widgetWithText(TextButton, 'Terminar').last);
    await tester.pumpAndSettle();
    expect(rutaActual(contenedor), Rutas.resumenPractica);
    await _recorrer(tester);
  });
}
