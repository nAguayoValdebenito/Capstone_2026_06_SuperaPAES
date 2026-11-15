import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:supera_paes/datos/fuentes/fuente_avisos_remota.dart';
import 'package:supera_paes/dominio/entidades/aviso_error.dart';
import 'package:supera_paes/nucleo/errores.dart';
import 'package:supera_paes/nucleo/tema.dart';
import 'package:supera_paes/presentacion/comunes/componentes.dart';
import 'package:supera_paes/presentacion/pregunta/hoja_avisar_error.dart';

import 'apoyo/adaptador_http_falso.dart';
import 'apoyo/app_de_prueba.dart';
import 'apoyo/repositorio_avisos_falso.dart';

const String _yaAvisado =
    'Ya nos avisaste de un error en esta pregunta. Lo estamos revisando.';

Widget _marco(ProviderContainer contenedor) => UncontrolledProviderScope(
  container: contenedor,
  child: MaterialApp(
    theme: TemaSuperaPaes.claro,
    themeAnimationDuration: Duration.zero,
    home: const Scaffold(
      body: SingleChildScrollView(
        child: HojaAvisarError(evaluacionId: 7, itemId: 70),
      ),
    ),
  ),
);

Future<void> _completar(WidgetTester tester, String comentario) async {
  await tester.tap(find.text('La respuesta correcta está mal'));
  await tester.pump();
  await tester.enterText(find.byKey(const Key('comentario-aviso')), comentario);
  await tester.pump();
}

Future<void> _enviar(WidgetTester tester) async {
  await tester.ensureVisible(find.text('Enviar aviso'));
  await tester.tap(find.text('Enviar aviso'));
}

VoidCallback? _envio(WidgetTester tester) => tester
    .widget<FilledButton>(
      find.ancestor(
        of: find.text('Enviar aviso'),
        matching: find.byType(FilledButton),
      ),
    )
    .onPressed;

void main() {
  group('FuenteAvisosRemota (HU-37)', () {
    test('pide los motivos con GET a /preguntas/avisos/motivos', () async {
      final adaptador = AdaptadorHttpFalso(
        (_) => respuestaOk([
          {'codigo': 'otro', 'nombre': 'Otro'},
        ]),
      );
      final motivos = await FuenteAvisosRemota(
        Dio()..httpClientAdapter = adaptador,
      ).motivos();
      expect(adaptador.peticiones.single.method, 'GET');
      expect(adaptador.peticiones.single.path, '/preguntas/avisos/motivos');
      expect(motivos.single.codigo, 'otro');
    });

    test('envía el motivo y el comentario al ítem, sin la versión', () async {
      final adaptador = AdaptadorHttpFalso(
        (_) => respuestaOk({
          'id': '41',
          'motivo': {'codigo': 'otro', 'nombre': 'Otro'},
          'estado': {'codigo': 'pendiente', 'nombre': 'Pendiente'},
          'creadoEn': '2026-11-15T13:00:00.000Z',
        }, estado: 201),
      );
      final fuente = FuenteAvisosRemota(Dio()..httpClientAdapter = adaptador);
      final enviado = await fuente.enviar(
        const DatosAviso(
          evaluacionId: 7,
          itemId: 70,
          motivo: 'otro',
          comentario: 'Falta un dato.',
        ),
      );
      final peticion = adaptador.peticiones.single;
      expect(peticion.method, 'POST');
      expect(peticion.path, '/evaluaciones/7/items/70/avisos');
      expect(peticion.data, {'motivo': 'otro', 'comentario': 'Falta un dato.'});
      expect(enviado.id, '41');
    });
  });

  group('A23 Avisar un error (HU-37)', () {
    testWidgets('confirma solo después de que el servidor guardó el aviso', (
      tester,
    ) async {
      final avisos = RepositorioAvisosFalso();
      await tester.pumpWidget(_marco(crearContenedor(avisos: avisos)));
      await tester.pumpAndSettle();
      expect(find.text('Error en el enunciado'), findsOneWidget);
      expect(_envio(tester), isNull);

      await _completar(tester, '  La correcta es la C.  ');
      expect(_envio(tester), isNotNull);
      await _enviar(tester);
      await tester.pumpAndSettle();

      final enviado = avisos.enviados.single;
      expect(enviado.motivo, 'respuesta');
      expect(enviado.comentario, 'La correcta es la C.');
      expect((enviado.evaluacionId, enviado.itemId), (7, 70));
      expect(find.text('Recibimos tu aviso'), findsOneWidget);
    });

    testWidgets('mientras envía no confirma nada', (tester) async {
      final espera = Completer<void>();
      final avisos = RepositorioAvisosFalso()..espera = espera;
      await tester.pumpWidget(_marco(crearContenedor(avisos: avisos)));
      await tester.pumpAndSettle();
      await _completar(tester, 'La correcta es la C.');
      await _enviar(tester);
      await tester.pump();

      expect(find.byType(CargandoEnBoton), findsOneWidget);
      expect(find.text('Recibimos tu aviso'), findsNothing);

      espera.complete();
      await tester.pumpAndSettle();
      expect(find.text('Recibimos tu aviso'), findsOneWidget);
    });

    testWidgets(
      'si el servidor rechaza el aviso, muestra el mensaje y conserva '
      'lo escrito',
      (tester) async {
        final avisos = RepositorioAvisosFalso(
          errorEnvio: const ErrorApi(
            codigo: 'CONFLICTO',
            mensaje: _yaAvisado,
            estadoHttp: 409,
          ),
        );
        await tester.pumpWidget(_marco(crearContenedor(avisos: avisos)));
        await tester.pumpAndSettle();
        await _completar(tester, 'La correcta es la C.');
        await _enviar(tester);
        await tester.pumpAndSettle();

        expect(find.text('Recibimos tu aviso'), findsNothing);
        expect(find.text(_yaAvisado), findsOneWidget);
        expect(find.text('La correcta es la C.'), findsOneWidget);
        expect(avisos.enviados, isEmpty);
      },
    );

    testWidgets('con un comentario de menos de 5 letras no deja enviar', (
      tester,
    ) async {
      await tester.pumpWidget(_marco(crearContenedor()));
      await tester.pumpAndSettle();
      await _completar(tester, ' mal ');
      expect(_envio(tester), isNull);
    });

    testWidgets('sin motivos, avisa el error y deja reintentar', (
      tester,
    ) async {
      final avisos = RepositorioAvisosFalso(
        errorMotivos: const ErrorApi(
          codigo: 'SIN_CONEXION',
          mensaje: 'Sin conexión por ahora.',
        ),
      );
      await tester.pumpWidget(_marco(crearContenedor(avisos: avisos)));
      await tester.pumpAndSettle();
      expect(find.text('Sin conexión por ahora.'), findsOneWidget);
      expect(find.text('Enviar aviso'), findsNothing);

      avisos.errorMotivos = null;
      await tester.ensureVisible(find.text('Reintentar'));
      await tester.tap(find.text('Reintentar'));
      await tester.pumpAndSettle();
      expect(find.text('Error en el enunciado'), findsOneWidget);
    });
  });
}
