import 'package:clock/clock.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:supera_paes/datos/modelos/evaluacion_con_tiempo_modelo.dart';
import 'package:supera_paes/dominio/entidades/evaluacion_con_tiempo.dart';
import 'package:supera_paes/nucleo/constantes.dart';
import 'package:supera_paes/nucleo/tema.dart';
import 'package:supera_paes/presentacion/comunes/animados.dart';
import 'package:supera_paes/presentacion/comunes/sello_prueba.dart';
import 'package:supera_paes/presentacion/evaluaciones/estado_evaluaciones.dart';
import 'package:supera_paes/presentacion/evaluaciones/reloj_evaluacion.dart';
import 'package:supera_paes/presentacion/evaluaciones/tarjetas_evaluaciones.dart';
import 'package:supera_paes/presentacion/resultado/momento_resultado.dart';

import 'apoyo/app_de_prueba.dart';
import 'apoyo/repositorio_cuentas_falso.dart';
import 'apoyo/repositorio_evaluaciones_falso.dart';
import 'apoyo/repositorio_resultados_falso.dart';

Widget _reloj(
  ProviderContainer contenedor, {
  bool reducido = false,
  VoidCallback? alVencer,
}) => UncontrolledProviderScope(
  container: contenedor,
  child: MaterialApp(
    theme: TemaSuperaPaes.claro,
    themeAnimationDuration: Duration.zero,
    home: MediaQuery(
      data: MediaQueryData(
        disableAnimations: reducido,
        textScaler: const TextScaler.linear(2),
      ),
      child: Scaffold(body: RelojEvaluacion(alVencer: alVencer ?? () {})),
    ),
  ),
);

EvaluacionConTiempo _evaluacion(DateTime vence, int segundos) =>
    EvaluacionConTiempo(
      id: 800,
      tipoNombre: 'Mini-ensayo',
      pruebaId: 2,
      preguntas: [preguntaConTiempo(1)],
      segundosRestantes: segundos,
      duracionSegundos: 600,
      venceEnServidor: vence,
    );

Color _fondo(WidgetTester tester) =>
    (tester
                .widget<AnimatedContainer>(
                  find.byKey(const ValueKey('fase-reloj')),
                )
                .decoration!
            as BoxDecoration)
        .color!;

void main() {
  testWidgets(
    'reloj inyectado: tres fases, dos anuncios y avisos de 3 segundos',
    (tester) async {
      var ahora = DateTime.utc(2038);
      final anuncios = <Object?>[];
      tester.binding.defaultBinaryMessenger.setMockDecodedMessageHandler(
        SystemChannels.accessibility,
        (mensaje) async {
          anuncios.add(mensaje);
          return null;
        },
      );
      addTearDown(
        () => tester.binding.defaultBinaryMessenger
            .setMockDecodedMessageHandler(SystemChannels.accessibility, null),
      );
      await withClock(Clock(() => ahora), () async {
        final contenedor = crearContenedor(sesion: sesionDeEjemplo);
        await iniciarApp(tester, contenedor);
        final vence = DateTime.utc(2026, 11, 8, 12, 10);
        contenedor
            .read(evaluacionConTiempoProvider.notifier)
            .retomar(_evaluacion(vence, 301));
        expect(contenedor.read(evaluacionConTiempoProvider)!.venceEn, vence);
        await tester.pumpWidget(_reloj(contenedor));
        await tester.pumpAndSettle();
        expect(_fondo(tester), TemaSuperaPaes.neutroSuave);
        ahora = ahora.add(const Duration(seconds: 1));
        await tester.pump(const Duration(seconds: 1));
        await tester.pumpAndSettle();
        expect(_fondo(tester), TemaSuperaPaes.logoOscuro);
        expect(
          find.text('Quedan 5 minutos. Puedes revisar tus respuestas.'),
          findsOneWidget,
        );
        expect(tester.widget<BarraAnimada>(find.byType(BarraAnimada)).alto, 3);
        await tester.pump(const Duration(seconds: 3));
        expect(find.byKey(const ValueKey('aviso-reloj')), findsNothing);
        // A27 y A28 montan relojes distintos para la misma evaluacion.
        await tester.pumpWidget(const SizedBox());
        await tester.pumpWidget(_reloj(contenedor));
        await tester.pumpAndSettle();
        ahora = ahora.add(const Duration(seconds: 240));
        await tester.pump(const Duration(seconds: 1));
        await tester.pumpAndSettle();
        expect(_fondo(tester), TemaSuperaPaes.errorSuave);
        expect(
          find.text('Queda 1 minuto. Revisa tus respuestas antes de entregar.'),
          findsOneWidget,
        );
        final mensajes = anuncios
            .whereType<Map<Object?, Object?>>()
            .where((m) => m['type'] == 'announce')
            .map((m) => (m['data']! as Map<Object?, Object?>)['message'])
            .toList();
        expect(mensajes, [
          'Quedan 5 minutos. Puedes revisar tus respuestas.',
          'Queda 1 minuto. Revisa tus respuestas antes de entregar.',
        ]);
        expect(tester.hasRunningAnimations, isFalse);
        expect(tester.takeException(), isNull);
        await tester.pumpWidget(const SizedBox());
      });
    },
  );

  testWidgets('reducido: colores finales y una sola entrega al vencer', (
    tester,
  ) async {
    var ahora = DateTime.utc(2038);
    var entregas = 0;
    await withClock(Clock(() => ahora), () async {
      final contenedor = crearContenedor(sesion: sesionDeEjemplo);
      await iniciarApp(tester, contenedor);
      contenedor
          .read(evaluacionConTiempoProvider.notifier)
          .retomar(_evaluacion(DateTime.utc(2026), 1));
      await tester.pumpWidget(
        _reloj(contenedor, reducido: true, alVencer: () => entregas++),
      );
      await tester.pump();
      expect(_fondo(tester), TemaSuperaPaes.errorSuave);
      expect(
        tester
            .widget<AnimatedContainer>(find.byKey(const ValueKey('fase-reloj')))
            .duration,
        Duration.zero,
      );
      expect(tester.hasRunningAnimations, isFalse);
      ahora = ahora.add(const Duration(seconds: 1));
      await tester.pump(const Duration(seconds: 1));
      await tester.pump(const Duration(seconds: 3));
      expect(entregas, 1);
      expect(find.text('0:00'), findsOneWidget);
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox());
    });
  });

  test('el modelo conserva la fecha limite recibida del servidor', () {
    final evaluacion = EvaluacionConTiempoModelo.iniciada({
      'id': 42,
      'pruebaId': 2,
      'preguntas': <Object?>[],
      'duracionMin': 48,
      'venceEn': '2026-11-08T12:48:00Z',
    }, tipoNombre: 'Mini-ensayo');
    expect(evaluacion.venceEnServidor, DateTime.utc(2026, 11, 8, 12, 48));
    expect(evaluacion.duracionSegundos, 2880);
  });

  for (final suscrito in [false, true]) {
    testWidgets(
      'A25: un solo boton lleno, ${suscrito ? 'suscrito' : 'gratis'}',
      (tester) async {
        final repo = RepositorioEvaluacionesFalso();
        if (suscrito) {
          repo
            ..motivoEnsayo = null
            ..mini = const DisponibilidadMiniEnsayo(
              pruebaId: 2,
              cantidad: 22,
              duracionMin: 48,
              ejes: 4,
              habilidades: 0,
              conPlan: true,
              gratisRestantes: null,
              disponible: true,
            );
        }
        final contenedor = crearContenedor(
          sesion: sesionDeEjemplo,
          evaluaciones: repo,
        );
        await iniciarApp(tester, contenedor, ruta: Rutas.evaluaciones);
        tester.view.physicalSize = const Size(600, 2000);
        await tester.pumpAndSettle();
        expect(find.byType(FilledButton), findsOneWidget);
        expect(
          find.widgetWithText(
            FilledButton,
            suscrito ? 'Rendir ensayo completo' : 'Rendir mini-ensayo',
          ),
          findsOneWidget,
        );
        expect(find.byType(ChipPrueba), findsNWidgets(3));
        expect(
          find.descendant(
            of: find.byType(TarjetaMiniEnsayo),
            matching: find.text(
              suscrito ? 'Incluido en tu plan' : '1 gratis este mes',
            ),
          ),
          findsOneWidget,
        );
        expect(tester.takeException(), isNull);
      },
    );
  }

  testWidgets('resultado reducido: 1.000 tabular y trazo completo', (
    tester,
  ) async {
    const datos = ensayoDePrueba;
    // Usa el contador real con el mismo contrato de puntaje de RN-23.
    await tester.pumpWidget(
      const MaterialApp(
        home: MediaQuery(
          data: MediaQueryData(
            disableAnimations: true,
            textScaler: TextScaler.linear(2),
          ),
          child: Scaffold(
            body: Column(
              children: [
                MomentoResultado(datos: datos),
                ContadorAnimado(
                  valor: 1000,
                  miles: true,
                  estilo: TemaSuperaPaes.display,
                ),
              ],
            ),
          ),
        ),
      ),
    );
    await tester.pump();
    expect(find.text('742'), findsOneWidget);
    expect(find.text('1.000'), findsOneWidget);
    expect(tester.hasRunningAnimations, isFalse);
    expect(tester.takeException(), isNull);
  });

  test('frase de ejes usa los datos reales y no inventa mejoras', () {
    expect(
      fraseDeResultado(miniEnsayoDePrueba),
      'Tu mejor eje fue Números. Geometría es lo que más te conviene reforzar.',
    );
  });
}
