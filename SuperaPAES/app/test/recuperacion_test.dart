import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:supera_paes/datos/fuentes/fuente_cuentas_remota.dart';
import 'package:supera_paes/nucleo/errores.dart';
import 'package:supera_paes/presentacion/enrutador.dart';

import 'apoyo/adaptador_http_falso.dart';
import 'apoyo/app_de_prueba.dart';
import 'apoyo/repositorio_cuentas_falso.dart';

void main() {
  group('FuenteCuentasRemota.solicitarRecuperacion', () {
    FuenteCuentasRemota fuenteCon(AdaptadorHttpFalso adaptador) =>
        FuenteCuentasRemota(Dio()..httpClientAdapter = adaptador);

    test('envía el correo y acepta el 202 de la API', () async {
      final adaptador = AdaptadorHttpFalso(
        (_) => respuestaOk({'solicitada': true}, estado: 202),
      );

      await fuenteCon(adaptador).solicitarRecuperacion('camila@ejemplo.cl');

      final peticion = adaptador.peticiones.single;
      expect(peticion.path, '/cuentas/recuperacion/solicitar');
      expect(peticion.data, {'correo': 'camila@ejemplo.cl'});
      // Es una ruta pública: no lleva token.
      expect(peticion.headers['Authorization'], isNull);
    });

    test('el límite de solicitudes llega como DEMASIADOS_INTENTOS', () async {
      final adaptador = AdaptadorHttpFalso(
        (_) => respuestaError(
          429,
          'DEMASIADOS_INTENTOS',
          'Hiciste demasiados intentos. Espera unos minutos y vuelve a '
              'probar.',
        ),
      );

      await expectLater(
        fuenteCon(adaptador).solicitarRecuperacion('camila@ejemplo.cl'),
        throwsA(
          isA<ErrorApi>()
              .having((e) => e.codigo, 'codigo', 'DEMASIADOS_INTENTOS')
              .having((e) => e.estadoHttp, 'estadoHttp', 429),
        ),
      );
    });

    test('un correo inválido llega con su problema de campo', () async {
      final adaptador = AdaptadorHttpFalso(
        (_) => respuestaError(
          400,
          'VALIDACION',
          'Los datos enviados no son válidos.',
          detalles: [
            {
              'lugar': 'cuerpo',
              'ruta': 'correo',
              'mensaje': 'Ingresa un correo válido.',
            },
          ],
        ),
      );

      await expectLater(
        fuenteCon(adaptador).solicitarRecuperacion('malo'),
        throwsA(
          isA<ErrorApi>().having(
            (e) => e.mensajeDeCampo('correo'),
            'correo',
            'Ingresa un correo válido.',
          ),
        ),
      );
    });
  });

  group('Pantalla Recuperar contraseña (A04)', () {
    late RepositorioCuentasFalso repositorio;
    late ProviderContainer contenedor;

    setUp(() => repositorio = RepositorioCuentasFalso());

    /// Abre Iniciar sesión, sin sesión, y toca «¿Olvidaste tu contraseña?».
    Future<void> abrir(WidgetTester tester) async {
      contenedor = crearContenedor(repositorio: repositorio);
      await iniciarApp(tester, contenedor);
      await tocar(
        tester,
        find.widgetWithText(TextButton, '¿Olvidaste tu contraseña?'),
      );
    }

    Future<void> enviar(WidgetTester tester, String correo) async {
      await tester.enterText(
        find.widgetWithText(TextFormField, 'Correo'),
        correo,
      );
      await tocar(tester, find.widgetWithText(FilledButton, 'Enviar enlace'));
    }

    testWidgets('se abre desde Iniciar sesión, sin sesión', (tester) async {
      await abrir(tester);

      expect(find.widgetWithText(AppBar, 'Recuperar contraseña'), findsOne);
      expect(find.byType(BackButton), findsOne);
    });

    testWidgets('sin un correo válido no envía nada', (tester) async {
      await abrir(tester);
      await enviar(tester, 'camila');

      expect(find.text('Ingresa un correo válido.'), findsOne);
      expect(repositorio.recuperaciones, isEmpty);
    });

    testWidgets('pide el enlace y confirma siempre lo mismo', (tester) async {
      await abrir(tester);
      await enviar(tester, '  camila@ejemplo.cl ');

      expect(repositorio.recuperaciones, ['camila@ejemplo.cl']);
      expect(find.text('Revisa tu correo'), findsOne);
      expect(
        find.textContaining(
          'Si camila@ejemplo.cl tiene una cuenta, te enviamos un enlace',
        ),
        findsOne,
      );
      expect(find.textContaining('Vence en 1 hora'), findsOne);
    });

    testWidgets('reenvía el enlace al mismo correo', (tester) async {
      await abrir(tester);
      await enviar(tester, 'camila@ejemplo.cl');
      await tocar(
        tester,
        find.widgetWithText(OutlinedButton, 'Reenviar el enlace'),
      );

      expect(repositorio.recuperaciones, [
        'camila@ejemplo.cl',
        'camila@ejemplo.cl',
      ]);
      expect(find.text('Te enviamos otro enlace'), findsOne);
    });

    testWidgets('con demasiados intentos muestra el aviso', (tester) async {
      repositorio.errorAlRecuperar = const ErrorApi(
        codigo: 'DEMASIADOS_INTENTOS',
        mensaje:
            'Hiciste demasiados intentos. Espera unos minutos y vuelve a '
            'probar.',
        estadoHttp: 429,
      );
      await abrir(tester);
      await enviar(tester, 'camila@ejemplo.cl');

      expect(find.textContaining('Hiciste demasiados intentos'), findsOne);
      expect(find.text('Revisa tu correo'), findsNothing);
    });

    testWidgets('«Volver a Iniciar sesión» vuelve a Iniciar sesión', (
      tester,
    ) async {
      await abrir(tester);
      await enviar(tester, 'camila@ejemplo.cl');
      await tocar(
        tester,
        find.widgetWithText(FilledButton, 'Volver a Iniciar sesión'),
      );

      expect(find.widgetWithText(AppBar, 'Iniciar sesión'), findsOne);
    });

    test('es una pantalla pública', () {
      expect(rutasPublicas, contains('/recuperar-contrasena'));
    });
  });
}
