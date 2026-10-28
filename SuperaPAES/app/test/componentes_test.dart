import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:supera_paes/nucleo/tema.dart';
import 'package:supera_paes/presentacion/comunes/componentes.dart';
import 'package:supera_paes/presentacion/comunes/componentes_seleccion.dart';
import 'package:supera_paes/presentacion/verificar_correo/campo_codigo.dart';

import 'apoyo/app_de_prueba.dart';

/// Monta un componente con el tema de la app.
Future<void> montar(WidgetTester tester, Widget hijo) => tester.pumpWidget(
  MaterialApp(
    theme: TemaSuperaPaes.claro,
    home: Scaffold(
      body: Padding(padding: const EdgeInsets.all(24), child: hijo),
    ),
  ),
);

void main() {
  testWidgets('CampoTexto muestra la etiqueta arriba y la ayuda abajo', (
    tester,
  ) async {
    await montar(
      tester,
      CampoTexto(
        etiqueta: 'Correo',
        controller: TextEditingController(),
        ayuda: 'El de tu cuenta.',
      ),
    );

    expect(find.text('Correo'), findsOne);
    expect(find.text('El de tu cuenta.'), findsOne);
    await tester.enterText(campo('Correo'), 'camila@ejemplo.cl');
    expect(find.text('camila@ejemplo.cl'), findsOne);
  });

  testWidgets('CampoContrasena oculta la contraseña y el ojo la muestra', (
    tester,
  ) async {
    await montar(
      tester,
      CampoContrasena(
        etiqueta: 'Contraseña',
        controller: TextEditingController(),
      ),
    );

    bool oculta() => tester.widget<TextField>(campo('Contraseña')).obscureText;
    expect(oculta(), isTrue);

    await tester.tap(find.byTooltip('Mostrar contraseña'));
    await tester.pump();
    expect(oculta(), isFalse);

    await tester.tap(find.byTooltip('Ocultar contraseña'));
    await tester.pump();
    expect(oculta(), isTrue);
  });

  testWidgets('SelectorSegmentado marca la opción activa y avisa el cambio', (
    tester,
  ) async {
    int? elegido;
    await montar(
      tester,
      SelectorSegmentado<int?>(
        opciones: const [(null, 'Mezcla'), (1, 'Fácil'), (2, 'Media')],
        seleccionado: null,
        onChanged: (valor) => elegido = valor,
      ),
    );

    expect(
      tester.getSemantics(find.text('Mezcla')),
      isSemantics(
        isButton: true,
        isSelected: true,
        isInMutuallyExclusiveGroup: true,
        label: 'Mezcla',
      ),
    );
    expect(
      tester.widget<Text>(find.text('Mezcla')).style?.color,
      TemaSuperaPaes.primario,
    );
    expect(
      tester.widget<Text>(find.text('Fácil')).style?.color,
      TemaSuperaPaes.textoSecundario,
    );

    await tester.tap(find.text('Media'));
    expect(elegido, 2);
  });

  testWidgets('OpcionRadio muestra su detalle bajo el título', (tester) async {
    await montar(
      tester,
      OpcionRadio(
        texto: 'Un contenido',
        detalle: 'Logaritmos',
        seleccionada: true,
        onTap: () {},
      ),
    );

    expect(find.text('Un contenido'), findsOne);
    expect(find.text('Logaritmos'), findsOne);
  });

  testWidgets('Aviso pone en negrita el texto destacado', (tester) async {
    await montar(
      tester,
      const Aviso(
        tono: TonoAviso.exito,
        destacado: 'Revisa tu correo.',
        texto: 'Te llegará un enlace.',
      ),
    );

    expect(find.text('Revisa tu correo. Te llegará un enlace.'), findsOne);
    expect(find.byIcon(Icons.check_circle_outline), findsOne);
  });

  testWidgets('CampoCodigo muestra un dígito por casilla y su error', (
    tester,
  ) async {
    final controller = TextEditingController();
    await montar(
      tester,
      CampoCodigo(controller: controller, error: 'El código tiene 6 dígitos.'),
    );

    await tester.enterText(campo('Código de 6 dígitos'), '1234567');
    await tester.pump();

    // Solo entran 6 dígitos.
    expect(controller.text, '123456');
    for (final digito in ['1', '2', '3', '4', '5', '6']) {
      expect(find.text(digito), findsOne);
    }
    expect(find.text('El código tiene 6 dígitos.'), findsOne);
  });
}
