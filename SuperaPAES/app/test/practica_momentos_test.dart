import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:supera_paes/dominio/entidades/cupo_de_hoy.dart';
import 'package:supera_paes/dominio/entidades/practica.dart';
import 'package:supera_paes/nucleo/constantes.dart';
import 'package:supera_paes/nucleo/tema.dart';
import 'package:supera_paes/presentacion/comunes/animados.dart';
import 'package:supera_paes/presentacion/comunes/componentes.dart';
import 'package:supera_paes/presentacion/comunes/componentes_seleccion.dart';
import 'package:supera_paes/presentacion/comunes/pulso.dart';
import 'package:supera_paes/presentacion/correccion/franja_correccion.dart';
import 'package:supera_paes/presentacion/practicar/estado_practica.dart';
import 'package:supera_paes/presentacion/practicar/momento_resumen.dart';
import 'package:supera_paes/presentacion/pregunta/hoja_avisar_error.dart';

import 'apoyo/app_de_prueba.dart';
import 'apoyo/repositorio_cuentas_falso.dart';
import 'apoyo/repositorio_cupo_falso.dart';

ResumenPractica _resumen(int correctas) => ResumenPractica(
  id: 400 + correctas,
  prueba: 'Matemática M1',
  alcance: Alcance.todaLaPrueba,
  dificultad: 'Mezcla',
  cantidad: 10,
  correctas: correctas,
  incorrectas: 10 - correctas,
  omitidas: 0,
  porcentaje: correctas * 10,
  tiempoUsadoSeg: 720,
);

Widget _marco(
  ProviderContainer contenedor,
  Widget hijo, {
  bool reducido = false,
  double letra = 1,
}) => UncontrolledProviderScope(
  container: contenedor,
  child: MaterialApp(
    theme: TemaSuperaPaes.claro,
    themeAnimationDuration: Duration.zero,
    home: MediaQuery(
      data: MediaQueryData(
        disableAnimations: reducido,
        textScaler: TextScaler.linear(letra),
      ),
      child: Scaffold(body: SingleChildScrollView(child: hijo)),
    ),
  ),
);

Widget _momento(int correctas) => MomentoResumen(
  key: ValueKey(correctas),
  resumen: _resumen(correctas),
  marcador: '$correctas/10',
  tiempo: '12 min',
);

void main() {
  testWidgets(
    'La racha se anuncia solo al aumentar y la cantidad no baja con el cupo',
    (tester) async {
      final cupo = RepositorioCupoFalso();
      final contenedor = crearContenedor(sesion: sesionDeEjemplo, cupo: cupo);
      await iniciarApp(tester, contenedor, ruta: Rutas.practicar);
      await tocar(tester, find.text('Empezar práctica'));
      final inicial = contenedor.read(practicaProvider).rachaInicial;
      final cantidad = contenedor.read(practicaProvider).enCurso!.cantidad;
      expect(inicial, 5);
      expect(find.text('Pregunta 1 de $cantidad'), findsOneWidget);
      cupo.cupo = CupoDeHoy(
        maximo: 10,
        usadas: 8,
        restantes: 2,
        saldoExtra: 5,
        reiniciaEn: cupoDeEjemplo.reiniciaEn,
        racha: 6,
      );
      await tocar(
        tester,
        find.byWidgetPredicate((w) => w is OpcionAlternativa && w.letra == 'C'),
      );
      await tocar(tester, find.text('Responder'));
      await tester.tap(find.text('Confirmar'));
      await tester.pumpAndSettle();
      expect(find.text('Pregunta 1 de $cantidad'), findsOneWidget);
      expect(find.text('Hoy te quedan 7', findRichText: true), findsOneWidget);
      await tocar(tester, find.text('Terminar'));
      await tester.tap(find.widgetWithText(OutlinedButton, 'Terminar'));
      await tester.pumpAndSettle();
      await tester.scrollUntilVisible(
        find.text('Tu racha subió a 6 días'),
        150,
        scrollable: find.byType(Scrollable).first,
      );
      expect(find.text('Tu racha subió a 6 días'), findsOneWidget);
      expect(find.byType(MarcaRacha), findsOneWidget);
      expect(contenedor.read(practicaProvider).rachaInicial, 5);
    },
  );
  for (final correctas in [7, 4]) {
    testWidgets(
      'Resumen ${correctas * 10} %: datos reales y umbral de destellos',
      (tester) async {
        final contenedor = crearContenedor(sesion: sesionDeEjemplo);
        await iniciarApp(tester, contenedor);
        await tester.pumpWidget(_marco(contenedor, _momento(correctas)));
        await tester.pumpAndSettle();
        expect(find.text('${correctas * 10} %'), findsOneWidget);
        expect(find.text('$correctas/10'), findsOneWidget);
        expect(
          tester.widget<AnilloAvance>(find.byType(AnilloAvance)).valor,
          correctas / 10,
        );
        expect(
          tester.widget<AnilloAvance>(find.byType(AnilloAvance)).destellos,
          correctas >= 7,
        );
        expect(tester.widget<LineaDatos>(find.byType(LineaDatos)).datos, [
          ('$correctas', 'correctas'),
          ('${10 - correctas}', 'incorrectas'),
          ('12 min', 'tiempo'),
        ]);
        expect(
          find.text(
            correctas == 7
                ? '¡Muy buena práctica! 7 de 10.'
                : 'Vas en camino: 4 de 10. '
                      'Repasa las que fallaste y vuelve a intentarlo.',
          ),
          findsOneWidget,
        );
        expect(find.byType(MarcaRacha), findsNothing);
        expect(tester.hasRunningAnimations, isFalse);
        expect(tester.takeException(), isNull);
      },
    );
  }

  testWidgets('Volver al mismo resumen no repite la celebracion', (
    tester,
  ) async {
    final contenedor = crearContenedor(sesion: sesionDeEjemplo);
    await iniciarApp(tester, contenedor);
    await tester.pumpWidget(_marco(contenedor, _momento(7)));
    await tester.pumpAndSettle();
    expect(
      tester.widget<AnilloAvance>(find.byType(AnilloAvance)).animar,
      isTrue,
    );
    await tester.pumpWidget(_marco(contenedor, const SizedBox()));
    await tester.pumpWidget(_marco(contenedor, _momento(7)));
    await tester.pumpAndSettle();
    final anillo = tester.widget<AnilloAvance>(find.byType(AnilloAvance));
    expect(anillo.animar, isFalse);
    expect(anillo.destellos, isFalse);
    expect(find.text('70 %'), findsOneWidget);
    expect(tester.hasRunningAnimations, isFalse);
  });

  for (final correctas in [7, 4]) {
    testWidgets(
      'Resumen ${correctas * 10} % con letra 2 y movimiento reducido',
      (tester) async {
        final contenedor = crearContenedor(sesion: sesionDeEjemplo);
        await iniciarApp(tester, contenedor);
        await tester.pumpWidget(
          _marco(contenedor, _momento(correctas), reducido: true, letra: 2),
        );
        await tester.pump();
        expect(find.text('${correctas * 10} %'), findsOneWidget);
        expect(find.byKey(const ValueKey('destellos-resumen')), findsNothing);
        expect(tester.hasRunningAnimations, isFalse);
        expect(tester.takeException(), isNull);
      },
    );
  }

  testWidgets('Activar movimiento reducido termina el anillo y el conteo', (
    tester,
  ) async {
    final contenedor = crearContenedor(sesion: sesionDeEjemplo);
    await iniciarApp(tester, contenedor);
    await tester.pumpWidget(_marco(contenedor, _momento(7)));
    await tester.pump(const Duration(milliseconds: 200));
    await tester.pumpWidget(_marco(contenedor, _momento(7), reducido: true));
    await tester.pump();
    expect(find.text('70 %'), findsOneWidget);
    expect(find.byKey(const ValueKey('destellos-resumen')), findsNothing);
    expect(tester.hasRunningAnimations, isFalse);
    expect(tester.takeException(), isNull);
  });

  for (final acerto in [true, false]) {
    testWidgets(
      'Franja de ${acerto ? 'acierto' : 'error'}: texto, vibracion y letra 2',
      (tester) async {
        final llamadas = <String>[];
        tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
          SystemChannels.platform,
          (llamada) async {
            if (llamada.method == 'HapticFeedback.vibrate') {
              llamadas.add(llamada.arguments as String);
            }
            return null;
          },
        );
        addTearDown(
          () => tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
            SystemChannels.platform,
            null,
          ),
        );
        final contenedor = crearContenedor();
        await tester.pumpWidget(
          _marco(
            contenedor,
            FranjaCorreccion(
              acerto: acerto,
              correcta: 'B',
              elegida: acerto ? 'B' : 'A',
            ),
            reducido: true,
            letra: 2,
          ),
        );
        await tester.pump();
        expect(
          find.text(acerto ? '¡Bien! Era la B.' : 'Era la B.'),
          findsOneWidget,
        );
        expect(llamadas, [
          if (acerto)
            'HapticFeedbackType.lightImpact'
          else
            'HapticFeedbackType.selectionClick',
        ]);
        expect(tester.hasRunningAnimations, isFalse);
        expect(tester.takeException(), isNull);
      },
    );
  }

  testWidgets('Alternativa seleccionada pulsa y vuelve a escala uno', (
    tester,
  ) async {
    final contenedor = crearContenedor();
    var seleccionada = false;
    await tester.pumpWidget(
      _marco(
        contenedor,
        StatefulBuilder(
          builder: (_, cambiar) => OpcionAlternativa(
            letra: 'A',
            texto: '32',
            seleccionada: seleccionada,
            conMovimiento: true,
            onTap: () => cambiar(() => seleccionada = true),
          ),
        ),
      ),
    );
    await tester.tap(find.byType(OpcionAlternativa));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 75));
    final pulso = find.byWidgetPredicate((w) => w is Pulso && w.activo);
    final transformacion = find
        .descendant(of: pulso, matching: find.byType(Transform))
        .first;
    expect(
      tester.widget<Transform>(transformacion).transform.entry(0, 0),
      closeTo(1.08, 0.001),
    );
    await tester.pumpAndSettle();
    expect(
      tester.widget<Transform>(transformacion).transform.entry(0, 0),
      closeTo(1, 0.001),
    );
  });

  testWidgets('A23 permite elegir motivo sin fingir un envio disponible', (
    tester,
  ) async {
    final contenedor = crearContenedor();
    await tester.pumpWidget(
      _marco(contenedor, const HojaAvisarError(), letra: 2),
    );
    await tester.pumpAndSettle();
    expect(find.byType(OpcionRadio), findsNWidgets(4));
    await tocar(tester, find.text('El enunciado tiene un error'));
    expect(
      tester
          .widgetList<OpcionRadio>(find.byType(OpcionRadio))
          .map((w) => w.seleccionada),
      [true, false, false, false],
    );
    await tester.scrollUntilVisible(
      find.text('Enviar aviso'),
      150,
      scrollable: find.byType(Scrollable).first,
    );
    expect(
      tester
          .widget<FilledButton>(
            find.widgetWithText(FilledButton, 'Enviar aviso'),
          )
          .onPressed,
      isNull,
    );
    expect(
      find.text('El envío de avisos aún no está disponible.'),
      findsOneWidget,
    );
    expect(tester.takeException(), isNull);
  });
}
