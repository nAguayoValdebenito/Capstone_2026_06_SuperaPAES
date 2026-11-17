import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:supera_paes/nucleo/tema.dart';
import 'package:supera_paes/presentacion/comunes/animados.dart';
import 'package:supera_paes/presentacion/comunes/boton_principal.dart';
import 'package:supera_paes/presentacion/comunes/componentes.dart';
import 'package:supera_paes/presentacion/comunes/componentes_seleccion.dart';
import 'package:supera_paes/presentacion/comunes/ejes.dart';
import 'package:supera_paes/presentacion/comunes/estados.dart';
import 'package:supera_paes/presentacion/comunes/glifos.dart';
import 'package:supera_paes/presentacion/comunes/hoja_confirmacion.dart';
import 'package:supera_paes/presentacion/comunes/movimiento.dart';
import 'package:supera_paes/presentacion/comunes/sello_prueba.dart';
import 'package:supera_paes/presentacion/comunes/trazo.dart';

/// Pruebas de la base de diseño y movimiento (Fase 0): tokens del tema y
/// componentes compartidos. Cada componente se prueba en su render, sus
/// estados, con «reducir movimiento» (que debe llegar al estado final en el
/// primer cuadro) y con la letra al doble, sin desbordarse.

/// Un solo tema para todos los montajes: así `AnimatedTheme` no anima al
/// volver a montar y no cuenta como animación en curso.
final ThemeData _tema = TemaSuperaPaes.claro;

/// Monta [hijo] con el tema de la app. [reducir] simula «Quitar animaciones»
/// y [escala] la letra del sistema.
Future<void> montar(
  WidgetTester tester,
  Widget hijo, {
  bool reducir = false,
  double escala = 1,
  double ancho = 360,
}) {
  tester.view
    ..physicalSize = Size(ancho, 800)
    ..devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  return tester.pumpWidget(
    MaterialApp(
      theme: _tema,
      builder: (context, hijoApp) => MediaQuery(
        data: MediaQuery.of(context).copyWith(
          disableAnimations: reducir,
          textScaler: TextScaler.linear(escala),
        ),
        child: hijoApp!,
      ),
      home: Scaffold(
        body: Padding(
          padding: const EdgeInsets.all(TemaSuperaPaes.espacio24),
          child: hijo,
        ),
      ),
    ),
  );
}

/// El pintor del trazo que hay en pantalla.
PintorTrazo _pintorTrazo(WidgetTester tester) =>
    tester
            .widget<CustomPaint>(
              find.byWidgetPredicate(
                (w) => w is CustomPaint && w.painter is PintorTrazo,
              ),
            )
            .painter!
        as PintorTrazo;

void main() {
  group('tema', () {
    test('los contenedores del esquema son neutros de la paleta (V-21)', () {
      final esquema = TemaSuperaPaes.claro.colorScheme;
      expect(esquema.surfaceContainerLowest, TemaSuperaPaes.superficie);
      expect(esquema.surfaceContainer, TemaSuperaPaes.superficie);
      expect(esquema.surfaceContainerHigh, TemaSuperaPaes.superficie);
      expect(esquema.surfaceContainerHighest, TemaSuperaPaes.neutroSuave);
      expect(esquema.surfaceTint, Colors.transparent);
    });

    test('diálogos y hojas toman la superficie y el radio de la app', () {
      final tema = TemaSuperaPaes.claro;
      expect(tema.dialogTheme.backgroundColor, TemaSuperaPaes.superficie);
      expect(tema.bottomSheetTheme.backgroundColor, TemaSuperaPaes.superficie);
      expect(tema.bottomSheetTheme.showDragHandle, isTrue);
      expect(
        tema.bottomSheetTheme.shape,
        const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(
            top: Radius.circular(TemaSuperaPaes.radioHoja),
          ),
        ),
      );
    });

    test('la barra inferior deja un indicador primarioSuave', () {
      expect(
        TemaSuperaPaes.claro.navigationBarTheme.indicatorColor,
        TemaSuperaPaes.primarioSuave,
      );
    });

    test('tabular() conserva el estilo y suma cifras tabulares', () {
      final estilo = TemaSuperaPaes.tabular(TemaSuperaPaes.numero);
      expect(estilo.fontSize, TemaSuperaPaes.numero.fontSize);
      expect(estilo.fontFeatures, TemaSuperaPaes.tabulares);
    });

    test('los tokens de movimiento son los de la guía', () {
      expect(TemaSuperaPaes.movimientoFoco, const Duration(milliseconds: 700));
      expect(TemaSuperaPaes.pasoEscalonado, const Duration(milliseconds: 40));
      expect(TemaSuperaPaes.topeEscalonado, 6);
      expect(TemaSuperaPaes.desplazamientoPantalla, 24);
      expect(TemaSuperaPaes.desplazamientoLista, 8);
      expect(TemaSuperaPaes.curvaLineal, Curves.linear);
      expect(TemaSuperaPaes.curvaEnfasis, Easing.emphasizedDecelerate);
    });

    test('las cinco pruebas tienen su código, y una desconocida usa M1', () {
      expect(Prueba.values.map((p) => p.codigo), [
        'CL',
        'M1',
        'M2',
        'HCS',
        'CIE',
      ]);
      expect(Prueba.deCodigo('HCS'), Prueba.hcs);
      expect(Prueba.deCodigo('XYZ'), Prueba.m1);
      expect({for (final p in Prueba.values) p.tono}.length, 5);
    });
  });

  group('duracion', () {
    Future<Duration> medir(
      WidgetTester tester, {
      required bool reducir,
      bool conservarFundido = false,
    }) async {
      late Duration resultado;
      await montar(
        tester,
        Builder(
          builder: (context) {
            resultado = duracion(
              context,
              TemaSuperaPaes.movimientoLento,
              conservarFundido: conservarFundido,
            );
            return const SizedBox();
          },
        ),
        reducir: reducir,
      );
      return resultado;
    }

    testWidgets('sin reducir movimiento devuelve la base', (tester) async {
      expect(
        await medir(tester, reducir: false),
        TemaSuperaPaes.movimientoLento,
      );
    });

    testWidgets('al reducir movimiento devuelve cero', (tester) async {
      expect(await medir(tester, reducir: true), Duration.zero);
    });

    testWidgets('conservarFundido deja 150 ms al reducir movimiento', (
      tester,
    ) async {
      expect(
        await medir(tester, reducir: true, conservarFundido: true),
        TemaSuperaPaes.movimientoRapido,
      );
    });
  });

  group('Presionable', () {
    testWidgets('responde al toque y se achica un poco al presionar', (
      tester,
    ) async {
      var toques = 0;
      await montar(
        tester,
        Presionable(
          onTap: () => toques++,
          child: const SizedBox(width: 200, height: 60),
        ),
      );
      final gesto = await tester.startGesture(
        tester.getCenter(find.byType(Presionable)),
      );
      await tester.pump(const Duration(milliseconds: 120));
      expect(
        tester.widget<AnimatedScale>(find.byType(AnimatedScale)).scale,
        0.98,
      );
      await gesto.up();
      await tester.pumpAndSettle();
      expect(toques, 1);
      expect(tester.widget<AnimatedScale>(find.byType(AnimatedScale)).scale, 1);
    });

    testWidgets('con movimiento reducido no cambia de tamaño', (tester) async {
      await montar(
        tester,
        Presionable(
          onTap: () {},
          child: const SizedBox(width: 200, height: 60),
        ),
        reducir: true,
      );
      final gesto = await tester.startGesture(
        tester.getCenter(find.byType(Presionable)),
      );
      await tester.pump(const Duration(milliseconds: 120));
      expect(tester.widget<AnimatedScale>(find.byType(AnimatedScale)).scale, 1);
      await gesto.up();
    });
  });

  group('AparecerEscalonado', () {
    double opacidad(WidgetTester tester) => tester
        .widget<FadeTransition>(find.byType(FadeTransition).last)
        .opacity
        .value;

    testWidgets('entra con fundido y termina visible', (tester) async {
      await montar(
        tester,
        const AparecerEscalonado(indice: 2, child: Text('Hola')),
      );
      expect(opacidad(tester), 0);
      await tester.pumpAndSettle();
      expect(opacidad(tester), 1);
    });

    testWidgets('pasado el tope, entra junto con el sexto', (tester) async {
      await montar(
        tester,
        const Column(
          children: [
            AparecerEscalonado(indice: 5, child: Text('Sexto')),
            AparecerEscalonado(indice: 40, child: Text('Cuadragésimo')),
          ],
        ),
      );
      await tester.pump(const Duration(milliseconds: 100));
      final fundidos = tester
          .widgetList<FadeTransition>(find.byType(FadeTransition))
          .toList();
      final opacidades = [
        for (final f in fundidos.skip(fundidos.length - 2)) f.opacity.value,
      ];
      expect(opacidades.first, opacidades.last);
      await tester.pumpAndSettle();
    });

    testWidgets('con movimiento reducido es visible en el primer cuadro', (
      tester,
    ) async {
      await montar(
        tester,
        const AparecerEscalonado(indice: 3, child: Text('Hola')),
        reducir: true,
      );
      expect(opacidad(tester), 1);
    });

    testWidgets('inactivo (no es la primera carga) no anima', (tester) async {
      await montar(
        tester,
        const AparecerEscalonado(indice: 0, activo: false, child: Text('Hola')),
      );
      expect(opacidad(tester), 1);
    });
  });

  group('BarraAnimada', () {
    testWidgets('dice su valor al lector de pantalla y se llena', (
      tester,
    ) async {
      await montar(
        tester,
        const BarraAnimada(valor: 0.7, etiquetaSemantica: '70 %'),
      );
      expect(find.bySemanticsLabel(RegExp('70')), findsNothing);
      expect(
        tester.getSemantics(find.byType(BarraAnimada)),
        matchesSemantics(value: '70 %'),
      );
      await tester.pump(const Duration(milliseconds: 50));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
    });

    testWidgets('al cambiar el valor sigue desde donde estaba', (tester) async {
      Widget barra(double valor) => BarraAnimada(valor: valor);
      await montar(tester, barra(0.2));
      await tester.pumpAndSettle();
      await montar(tester, barra(0.9));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
    });

    testWidgets('con movimiento reducido no deja animaciones pendientes', (
      tester,
    ) async {
      await montar(
        tester,
        const BarraAnimada(valor: 0.5, retraso: Duration(milliseconds: 200)),
        reducir: true,
      );
      expect(tester.hasRunningAnimations, isFalse);
    });

    testWidgets('con la letra al doble cabe en un ancho chico', (tester) async {
      await montar(tester, const BarraAnimada(valor: 1), escala: 2, ancho: 200);
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
    });
  });

  group('ContadorAnimado', () {
    testWidgets('cuenta hasta el valor y el lector oye solo el final', (
      tester,
    ) async {
      await montar(
        tester,
        const ContadorAnimado(
          valor: 72,
          sufijo: ' %',
          estilo: TemaSuperaPaes.display,
        ),
      );
      expect(find.text('0 %'), findsOne);
      expect(find.bySemanticsLabel('72 %'), findsOne);
      await tester.pumpAndSettle();
      expect(find.text('72 %'), findsOne);
    });

    testWidgets(
      'con movimiento reducido muestra el valor en el primer cuadro',
      (tester) async {
        await montar(
          tester,
          const ContadorAnimado(
            valor: 742,
            desde: 100,
            miles: true,
            estilo: TemaSuperaPaes.display,
          ),
          reducir: true,
        );
        expect(find.text('742'), findsOne);
      },
    );

    testWidgets('pone el punto de miles y usa cifras tabulares', (
      tester,
    ) async {
      await montar(
        tester,
        const ContadorAnimado(
          valor: 1000,
          miles: true,
          estilo: TemaSuperaPaes.display,
        ),
        reducir: true,
      );
      final texto = tester.widget<Text>(find.text('1.000'));
      expect(texto.style!.fontFeatures, TemaSuperaPaes.tabulares);
    });

    testWidgets('con la letra al doble no se parte ni se desborda', (
      tester,
    ) async {
      await montar(
        tester,
        const SizedBox(
          width: 90,
          child: ContadorAnimado(
            valor: 1000,
            miles: true,
            estilo: TemaSuperaPaes.display,
          ),
        ),
        reducir: true,
        escala: 2,
      );
      expect(tester.takeException(), isNull);
    });
  });

  group('AnilloAvance', () {
    testWidgets('se llena, muestra su centro y termina sin pendientes', (
      tester,
    ) async {
      await montar(
        tester,
        const AnilloAvance(valor: 0.8, centro: Text('80 %'), destellos: true),
      );
      expect(find.text('80 %'), findsOne);
      await tester.pumpAndSettle();
      expect(tester.hasRunningAnimations, isFalse);
      expect(tester.takeException(), isNull);
    });

    testWidgets('con movimiento reducido llega lleno y sin destellos', (
      tester,
    ) async {
      await montar(
        tester,
        const AnilloAvance(valor: 0.8, centro: Text('80 %'), destellos: true),
        reducir: true,
      );
      expect(tester.hasRunningAnimations, isFalse);
      expect(find.text('80 %'), findsOne);
    });

    testWidgets('con la letra al doble el centro se achica y no se desborda', (
      tester,
    ) async {
      await montar(
        tester,
        const AnilloAvance(
          valor: 0.5,
          centro: Text('100 %', style: TemaSuperaPaes.display),
        ),
        escala: 2,
        reducir: true,
      );
      expect(tester.takeException(), isNull);
    });
  });

  group('Sacudida', () {
    testWidgets('se mueve al fallar y vuelve a su lugar', (tester) async {
      Widget caja(int veces) => Sacudida(
        veces: veces,
        child: const SizedBox(key: Key('caja'), width: 50, height: 20),
      );
      await montar(tester, caja(0));
      final origen = tester.getTopLeft(find.byKey(const Key('caja')));
      await montar(tester, caja(1));
      await tester.pump(const Duration(milliseconds: 40));
      expect(tester.getTopLeft(find.byKey(const Key('caja'))), isNot(origen));
      await tester.pumpAndSettle();
      expect(tester.getTopLeft(find.byKey(const Key('caja'))), origen);
    });

    testWidgets('con movimiento reducido no se mueve', (tester) async {
      await montar(
        tester,
        const Sacudida(
          veces: 1,
          child: SizedBox(key: Key('caja'), width: 50, height: 20),
        ),
        reducir: true,
      );
      final origen = tester.getTopLeft(find.byKey(const Key('caja')));
      await tester.pump(const Duration(milliseconds: 40));
      expect(tester.getTopLeft(find.byKey(const Key('caja'))), origen);
    });
  });

  group('Cambiante', () {
    Widget con(String clave) =>
        Cambiante(clave: clave, child: Text('Texto $clave'));

    testWidgets('funde del texto anterior al nuevo en 200 ms', (tester) async {
      await montar(tester, con('a'));
      await montar(tester, con('b'));
      await tester.pump(const Duration(milliseconds: 100));
      expect(find.text('Texto a'), findsOne);
      expect(find.text('Texto b'), findsOne);
      await tester.pump(const Duration(milliseconds: 150));
      expect(find.text('Texto a'), findsNothing);
      expect(find.text('Texto b'), findsOne);
    });

    testWidgets('con movimiento reducido el fundido dura 150 ms', (
      tester,
    ) async {
      await montar(tester, con('a'), reducir: true);
      await montar(tester, con('b'), reducir: true);
      await tester.pump(const Duration(milliseconds: 80));
      expect(find.text('Texto a'), findsOne);
      await tester.pump(const Duration(milliseconds: 100));
      expect(find.text('Texto a'), findsNothing);
      expect(find.text('Texto b'), findsOne);
    });
  });

  group('MarcaRacha y Trazo', () {
    testWidgets('la racha se dibuja de a poco al encenderse', (tester) async {
      await montar(tester, const MarcaRacha(encender: true));
      expect(_pintorTrazo(tester).avance, 0);
      await tester.pumpAndSettle();
      expect(_pintorTrazo(tester).avance, 1);
    });

    testWidgets('con movimiento reducido el trazo llega completo', (
      tester,
    ) async {
      await montar(tester, const MarcaRacha(encender: true), reducir: true);
      expect(_pintorTrazo(tester).avance, 1);
    });

    testWidgets('crece con la letra', (tester) async {
      await montar(tester, const MarcaRacha(), escala: 2);
      expect(tester.getSize(find.byType(Trazo)).width, greaterThan(22));
    });

    testWidgets('TrazoAnimado parte en cero y llega a [hasta]', (tester) async {
      await montar(tester, const TrazoAnimado(hasta: 0.78));
      expect(_pintorTrazo(tester).avance, 0);
      await tester.pumpAndSettle();
      expect(_pintorTrazo(tester).avance, closeTo(0.78, 0.001));
    });

    testWidgets('TrazoAnimado con retraso espera antes de dibujar', (
      tester,
    ) async {
      await montar(
        tester,
        const TrazoAnimado(retraso: Duration(milliseconds: 300)),
      );
      await tester.pump(const Duration(milliseconds: 200));
      expect(_pintorTrazo(tester).avance, 0);
      await tester.pumpAndSettle();
      expect(_pintorTrazo(tester).avance, 1);
    });

    testWidgets('TrazoAnimado con movimiento reducido llega completo', (
      tester,
    ) async {
      await montar(tester, const TrazoAnimado(), reducir: true);
      expect(_pintorTrazo(tester).avance, 1);
    });

    testWidgets('SimboloLogo se lee como «Supera PAES» y dibuja su trazo', (
      tester,
    ) async {
      await montar(tester, const SimboloLogo(ancho: 120, avance: 0.5));
      expect(find.bySemanticsLabel('Supera PAES'), findsOne);
      expect(
        find.byWidgetPredicate(
          (w) => w is CustomPaint && w.painter is PintorTrazoLogo,
        ),
        findsOne,
      );
    });
  });

  group('GrupoEsqueleto y Bloque', () {
    testWidgets('varios bloques laten con un solo controlador', (tester) async {
      await montar(
        tester,
        const GrupoEsqueleto(
          child: Column(children: [Bloque(), Bloque(), Bloque(alto: 40)]),
        ),
      );
      expect(find.bySemanticsLabel('Cargando'), findsOne);
      expect(tester.binding.transientCallbackCount, 1);
      await tester.pump(const Duration(milliseconds: 600));
      expect(tester.takeException(), isNull);
    });

    testWidgets('quieto y con movimiento reducido no animan', (tester) async {
      await montar(tester, const GrupoEsqueleto(quieto: true, child: Bloque()));
      expect(tester.hasRunningAnimations, isFalse);
      await montar(
        tester,
        const GrupoEsqueleto(child: Bloque()),
        reducir: true,
      );
      expect(tester.hasRunningAnimations, isFalse);
    });

    testWidgets('EsqueletoTarjeta crea su grupo solo si no hay uno', (
      tester,
    ) async {
      await montar(tester, const EsqueletoTarjeta());
      expect(find.bySemanticsLabel('Cargando'), findsOne);
      await montar(
        tester,
        const GrupoEsqueleto(
          child: Column(children: [EsqueletoTarjeta(), EsqueletoTarjeta()]),
        ),
      );
      expect(find.bySemanticsLabel('Cargando'), findsOne);
      expect(tester.binding.transientCallbackCount, 1);
    });

    testWidgets('con la letra al doble no se desborda', (tester) async {
      await montar(
        tester,
        const GrupoEsqueleto(child: EsqueletoTarjeta(lineas: 4)),
        escala: 2,
      );
      expect(tester.takeException(), isNull);
    });
  });

  group('BotonPrincipal', () {
    Widget boton(
      EstadoBoton estado, {
      VoidCallback? alTocar,
      String? error,
      int fallos = 0,
    }) => BotonPrincipal(
      texto: 'Ingresar',
      estado: estado,
      error: error,
      intentosFallidos: fallos,
      onPressed: alTocar ?? () {},
    );

    testWidgets('normal: muestra el texto y responde al toque', (tester) async {
      var toques = 0;
      await montar(tester, boton(EstadoBoton.normal, alTocar: () => toques++));
      await tester.tap(find.text('Ingresar'));
      await tester.pumpAndSettle();
      expect(toques, 1);
    });

    testWidgets('cargando: sigue azul, muestra la rueda y no repite el envío', (
      tester,
    ) async {
      var toques = 0;
      await montar(
        tester,
        boton(EstadoBoton.cargando, alTocar: () => toques++),
      );
      await tester.pump(const Duration(milliseconds: 300));
      expect(find.byType(CircularProgressIndicator), findsOne);
      expect(find.text('Ingresar'), findsNothing);
      await tester.tap(find.byType(FilledButton), warnIfMissed: false);
      expect(toques, 0);
      final boton0 = tester.widget<FilledButton>(find.byType(FilledButton));
      expect(boton0.onPressed, isNotNull); // no se apaga a gris
      expect(find.bySemanticsLabel('Ingresar, enviando'), findsOne);
    });

    testWidgets('éxito: muestra el ✓ en verde', (tester) async {
      await montar(tester, boton(EstadoBoton.exito));
      await tester.pump(const Duration(milliseconds: 300));
      expect(find.byIcon(Icons.check_rounded), findsOne);
      final estilo = tester
          .widget<FilledButton>(find.byType(FilledButton))
          .style!;
      expect(estilo.backgroundColor!.resolve({}), TemaSuperaPaes.exito);
    });

    testWidgets('error: pone el mensaje encima y se sacude', (tester) async {
      await montar(
        tester,
        boton(EstadoBoton.error, error: 'Revisa tus datos.', fallos: 1),
      );
      expect(find.text('Revisa tus datos.'), findsOne);
      expect(find.text('Ingresar'), findsOne);
      await tester.pumpAndSettle();
    });

    testWidgets('sin onPressed queda deshabilitado', (tester) async {
      await montar(
        tester,
        const BotonPrincipal(texto: 'Ingresar', onPressed: null),
      );
      expect(
        tester.widget<FilledButton>(find.byType(FilledButton)).onPressed,
        isNull,
      );
    });

    testWidgets('con movimiento reducido corta entre estados', (tester) async {
      await montar(tester, boton(EstadoBoton.normal), reducir: true);
      await montar(tester, boton(EstadoBoton.cargando), reducir: true);
      await tester.pump();
      expect(find.byType(CircularProgressIndicator), findsOne);
      expect(find.text('Ingresar'), findsNothing);
    });

    testWidgets('con la letra al doble el texto no se desborda', (
      tester,
    ) async {
      await montar(tester, boton(EstadoBoton.normal), escala: 2, ancho: 240);
      expect(tester.takeException(), isNull);
    });
  });

  group('Destacado, FondoCuaderno y LineaDatos', () {
    testWidgets('Destacado muestra su texto y su ícono', (tester) async {
      await montar(
        tester,
        const Destacado(texto: 'Reforzar', icono: Icons.flag_rounded),
      );
      expect(find.text('Reforzar'), findsOne);
      expect(find.byIcon(Icons.flag_rounded), findsOne);
    });

    testWidgets('FondoCuaderno pinta la cuadrícula detrás del contenido', (
      tester,
    ) async {
      await montar(tester, const FondoCuaderno(child: Text('Contenido')));
      expect(find.text('Contenido'), findsOne);
      expect(
        find.descendant(
          of: find.byType(FondoCuaderno),
          matching: find.byType(RepaintBoundary),
        ),
        findsWidgets,
      );
    });

    testWidgets('LineaDatos pasa a la línea siguiente con letra grande', (
      tester,
    ) async {
      const datos = [
        ('8', 'correctas'),
        ('2', 'incorrectas'),
        ('9 min', 'de tiempo'),
      ];
      await montar(tester, const LineaDatos(datos: datos));
      final alto1 = tester.getSize(find.byType(LineaDatos)).height;
      await montar(tester, const LineaDatos(datos: datos), escala: 2);
      expect(tester.takeException(), isNull);
      expect(
        tester.getSize(find.byType(LineaDatos)).height,
        greaterThan(alto1),
      );
    });
  });

  group('glifos y sellos', () {
    testWidgets(
      'los cinco glifos de prueba y los cinco de pestaña se dibujan',
      (tester) async {
        await montar(
          tester,
          Wrap(
            children: [
              for (final p in Prueba.values) GlifoPrueba(p, tamano: 32),
              for (var i = 0; i < 5; i++)
                IconoPestana(
                  i,
                  color: TemaSuperaPaes.primario,
                  tamano: 32,
                  activa: i.isEven,
                ),
            ],
          ),
        );
        expect(find.byType(GlifoPrueba), findsNWidgets(5));
        expect(find.byType(IconoPestana), findsNWidgets(5));
        expect(tester.takeException(), isNull);
      },
    );

    testWidgets('SelloPrueba usa el fondo de su prueba o blanco sobre marca', (
      tester,
    ) async {
      await montar(
        tester,
        const Row(
          children: [
            SelloPrueba(Prueba.cl),
            SelloPrueba(Prueba.cie, sobreMarca: true),
          ],
        ),
      );
      final colores = tester
          .widgetList<Container>(find.byType(Container))
          .map((c) => (c.decoration as BoxDecoration?)?.color)
          .whereType<Color>()
          .toList();
      expect(colores, contains(Prueba.cl.fondo));
      expect(colores, contains(TemaSuperaPaes.superficie));
    });

    testWidgets('ChipPrueba elegido suma un ✓ y avisa que está seleccionado', (
      tester,
    ) async {
      Prueba? elegida;
      await montar(
        tester,
        ChipsDePrueba(
          pruebas: Prueba.values,
          seleccionada: Prueba.m2,
          onChanged: (p) => elegida = p,
        ),
      );
      expect(find.byIcon(Icons.check_rounded), findsOne);
      expect(
        tester.getSemantics(find.bySemanticsLabel('Matemática 2')),
        matchesSemantics(
          label: 'Matemática 2',
          isButton: true,
          isSelected: true,
          hasSelectedState: true,
          hasTapAction: true,
        ),
      );
      await tester.tap(find.text('Historia'));
      await tester.pumpAndSettle();
      expect(elegida, Prueba.hcs);
    });

    testWidgets(
      'los chips miden 48 de alto y pasan de línea con letra grande',
      (tester) async {
        await montar(
          tester,
          ChipsDePrueba(
            pruebas: Prueba.values,
            seleccionada: Prueba.cl,
            onChanged: (_) {},
          ),
          escala: 2,
          reducir: true,
        );
        expect(tester.takeException(), isNull);
        for (final chip in tester.widgetList(find.byType(ChipPrueba))) {
          final alto = tester.getSize(find.byWidget(chip)).height;
          expect(alto, greaterThanOrEqualTo(TemaSuperaPaes.zonaTactil));
        }
      },
    );
  });

  group('FilaEje', () {
    testWidgets('el nivel sale del porcentaje (RN-14) y se lee completo', (
      tester,
    ) async {
      expect(nivelDeEje(0.59).texto, 'Reforzar');
      expect(nivelDeEje(0.6).texto, 'En camino');
      expect(nivelDeEje(0.7).texto, 'Firme');
      await montar(
        tester,
        const Column(
          children: [
            FilaEje(nombre: 'Geometría', valor: 0.5, indice: 0),
            FilaEje(nombre: 'Álgebra', valor: 0.9, indice: 1),
          ],
        ),
      );
      expect(find.text('Reforzar'), findsOne);
      expect(find.text('Firme'), findsOne);
      expect(find.text('50 %'), findsOne);
      expect(find.bySemanticsLabel('Geometría: 50 %, Reforzar'), findsOne);
      await tester.pumpAndSettle();
    });

    testWidgets('con la letra al doble no se desborda', (tester) async {
      await montar(
        tester,
        const FilaEje(
          nombre: 'Números y proporcionalidad',
          valor: 0.55,
          indice: 0,
        ),
        escala: 2,
        reducir: true,
      );
      expect(tester.takeException(), isNull);
    });
  });

  group('Aviso, Etiqueta, IconoEnCirculo y ListaDeFilas', () {
    testWidgets('Aviso es una hoja blanca con borde y el ícono en su tono', (
      tester,
    ) async {
      await montar(
        tester,
        const Aviso(tono: TonoAviso.aviso, texto: 'Tiene reloj.'),
      );
      final caja =
          tester
                  .widget<Container>(
                    find
                        .descendant(
                          of: find.byType(Aviso),
                          matching: find.byType(Container),
                        )
                        .first,
                  )
                  .decoration!
              as BoxDecoration;
      expect(caja.color, TemaSuperaPaes.superficie);
      expect(caja.border, isNotNull);
      final icono = tester.widget<Icon>(find.byType(Icon));
      expect(icono.color, TemaSuperaPaes.primarioOscuro);
    });

    testWidgets('el error y el éxito llevan su propio ícono, no solo color', (
      tester,
    ) async {
      await montar(
        tester,
        const Column(
          children: [
            Aviso(tono: TonoAviso.error, texto: 'No pudimos.'),
            Aviso(tono: TonoAviso.exito, texto: 'Listo.'),
          ],
        ),
      );
      expect(find.byIcon(Icons.cancel_outlined), findsOne);
      expect(find.byIcon(Icons.check_circle_outline_rounded), findsOne);
    });

    testWidgets('Etiqueta no usa píldora: aviso va destacada y éxito con ✓', (
      tester,
    ) async {
      await montar(
        tester,
        const Column(
          children: [
            Etiqueta(texto: 'Sin verificar', tono: TonoEtiqueta.aviso),
            Etiqueta(texto: 'Rendido', tono: TonoEtiqueta.exito),
            Etiqueta(texto: 'Incorrecta', tono: TonoEtiqueta.error),
          ],
        ),
      );
      expect(find.byType(Destacado), findsOne);
      expect(find.byIcon(Icons.check_circle_rounded), findsOne);
      expect(find.byIcon(Icons.cancel_rounded), findsOne);
      expect(find.byType(DecoratedBox), findsNothing);
    });

    testWidgets('IconoEnCirculo es un ícono suelto y decorativo', (
      tester,
    ) async {
      await montar(tester, const IconoEnCirculo(icono: Icons.timer_outlined));
      expect(find.byIcon(Icons.timer_outlined), findsOne);
      expect(
        find.descendant(
          of: find.byType(IconoEnCirculo),
          matching: find.byType(DecoratedBox),
        ),
        findsNothing,
      );
    });

    testWidgets('ListaDeFilas es plana con borde, sin sombra', (tester) async {
      await montar(
        tester,
        ListaDeFilas(
          filas: [
            FilaNavegacion(texto: 'Mis datos', onTap: () {}),
            FilaNavegacion(texto: 'Legal', onTap: () {}),
          ],
        ),
      );
      final material = tester.widget<Material>(
        find
            .descendant(
              of: find.byType(ListaDeFilas),
              matching: find.byType(Material),
            )
            .first,
      );
      expect(material.elevation, 0);
      expect(
        (material.shape! as RoundedRectangleBorder).side.color,
        TemaSuperaPaes.borde,
      );
      expect(find.byType(Divider), findsOne);
    });
  });

  group('HojaConfirmacion', () {
    Future<void> abrir(
      WidgetTester tester,
      ValueChanged<bool> alCerrar, {
      bool confirmarEsPrincipal = true,
      bool reducir = false,
    }) async {
      await montar(
        tester,
        Builder(
          builder: (context) => TextButton(
            onPressed: () async => alCerrar(
              await confirmarEnHoja(
                context,
                HojaConfirmacion(
                  titulo: '¿Terminar?',
                  contenido: const Text('Se guarda lo que respondiste.'),
                  confirmar: 'Terminar',
                  cancelar: 'Seguir practicando',
                  confirmarEsPrincipal: confirmarEsPrincipal,
                  icono: Icons.flag_rounded,
                ),
              ),
            ),
            child: const Text('Abrir'),
          ),
        ),
        reducir: reducir,
      );
      await tester.tap(find.text('Abrir'));
      await tester.pumpAndSettle();
    }

    testWidgets('confirmar devuelve true', (tester) async {
      bool? resultado;
      await abrir(tester, (r) => resultado = r);
      expect(find.text('¿Terminar?'), findsOne);
      expect(find.byIcon(Icons.flag_rounded), findsOne);
      await tester.tap(find.widgetWithText(FilledButton, 'Terminar'));
      await tester.pumpAndSettle();
      expect(resultado, isTrue);
    });

    testWidgets('«Seguir practicando» como principal devuelve false', (
      tester,
    ) async {
      bool? resultado;
      await abrir(tester, (r) => resultado = r, confirmarEsPrincipal: false);
      expect(find.widgetWithText(FilledButton, 'Seguir practicando'), findsOne);
      expect(find.widgetWithText(OutlinedButton, 'Terminar'), findsOne);
      await tester.tap(find.text('Seguir practicando'));
      await tester.pumpAndSettle();
      expect(resultado, isFalse);
    });

    testWidgets('con movimiento reducido igual se abre y se cierra', (
      tester,
    ) async {
      bool? resultado;
      await abrir(tester, (r) => resultado = r, reducir: true);
      await tester.tap(find.text('Terminar'));
      await tester.pumpAndSettle();
      expect(resultado, isTrue);
    });
  });

  group('PantallaFormulario', () {
    Widget pantalla() =>
        const PantallaFormulario(hijos: [Text('Contenido')], pie: Text('Pie'));

    Future<void> montarPantalla(WidgetTester tester, double escala) async {
      tester.view
        ..physicalSize = const Size(360, 640)
        ..devicePixelRatio = 1;
      addTearDown(tester.view.reset);
      await tester.pumpWidget(
        MaterialApp(
          theme: _tema,
          builder: (context, hijo) => MediaQuery(
            data: MediaQuery.of(
              context,
            ).copyWith(textScaler: TextScaler.linear(escala)),
            child: hijo!,
          ),
          home: pantalla(),
        ),
      );
    }

    testWidgets('lleva el fondo de cuaderno y el pie fijo con letra normal', (
      tester,
    ) async {
      await montarPantalla(tester, 1);
      expect(find.byType(FondoCuaderno), findsOne);
      expect(
        find.descendant(of: find.byType(ListView), matching: find.text('Pie')),
        findsNothing,
      );
      expect(find.text('Pie'), findsOne);
    });

    testWidgets('con letra de 1,5 o más el pie pasa al final del contenido', (
      tester,
    ) async {
      await montarPantalla(tester, 1.5);
      expect(
        find.descendant(of: find.byType(ListView), matching: find.text('Pie')),
        findsOne,
      );
      await montarPantalla(tester, 2);
      expect(
        find.descendant(of: find.byType(ListView), matching: find.text('Pie')),
        findsOne,
      );
      expect(tester.takeException(), isNull);
    });
  });
}
