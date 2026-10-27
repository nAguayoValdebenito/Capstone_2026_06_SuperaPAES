import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:supera_paes/datos/fuentes/fuente_verificacion_remota.dart';
import 'package:supera_paes/nucleo/cliente_http.dart';
import 'package:supera_paes/nucleo/constantes.dart';
import 'package:supera_paes/nucleo/errores.dart';
import 'package:supera_paes/presentacion/comunes/estado_cuenta.dart';

import 'apoyo/adaptador_http_falso.dart';
import 'apoyo/app_de_prueba.dart';
import 'apoyo/repositorio_cuentas_falso.dart';

const _codigoIncorrecto = ErrorApi(
  codigo: 'CODIGO_INCORRECTO',
  mensaje: 'El código no es correcto. Te quedan 4 intentos.',
  estadoHttp: 400,
);

const _codigoAgotado = ErrorApi(
  codigo: 'CODIGO_AGOTADO',
  mensaje:
      'Se acabaron los intentos para escribir el código. Pide que te '
      'enviemos un correo nuevo.',
  estadoHttp: 409,
);

void main() {
  group('FuenteVerificacionRemota', () {
    FuenteVerificacionRemota fuenteCon(AdaptadorHttpFalso adaptador) =>
        FuenteVerificacionRemota(Dio()..httpClientAdapter = adaptador);

    test('envía el código de 6 dígitos', () async {
      final adaptador = AdaptadorHttpFalso(
        (_) => respuestaOk({'verificado': true, 'yaVerificado': false}),
      );

      await fuenteCon(adaptador).verificarCodigo('194987');

      final peticion = adaptador.peticiones.single;
      expect(peticion.path, '/cuentas/verificacion/codigo');
      expect(peticion.data, {'codigo': '194987'});
    });

    test('el código incorrecto llega con el mensaje de los intentos', () async {
      final adaptador = AdaptadorHttpFalso(
        (_) => respuestaError(
          400,
          'CODIGO_INCORRECTO',
          'El código no es correcto. Te quedan 4 intentos.',
          detalles: {'intentosRestantes': 4},
        ),
      );

      await expectLater(
        fuenteCon(adaptador).verificarCodigo('000000'),
        throwsA(
          isA<ErrorApi>()
              .having((e) => e.codigo, 'codigo', 'CODIGO_INCORRECTO')
              .having(
                (e) => e.mensaje,
                'mensaje',
                'El código no es correcto. Te quedan 4 intentos.',
              )
              // detalles es un objeto, no la lista de problemas por campo.
              .having((e) => e.problemas, 'problemas', isEmpty),
        ),
      );
    });

    test('el código agotado llega como CODIGO_AGOTADO', () async {
      final adaptador = AdaptadorHttpFalso(
        (_) => respuestaError(
          409,
          'CODIGO_AGOTADO',
          'Se acabaron los intentos para escribir el código. Pide que te '
              'enviemos un correo nuevo.',
        ),
      );

      await expectLater(
        fuenteCon(adaptador).verificarCodigo('123456'),
        throwsA(
          isA<ErrorApi>()
              .having((e) => e.codigo, 'codigo', 'CODIGO_AGOTADO')
              .having((e) => e.estadoHttp, 'estadoHttp', 409),
        ),
      );
    });

    test('reenvía sin cuerpo y lee el resultado', () async {
      final adaptador = AdaptadorHttpFalso(
        (_) => respuestaOk({'enviado': false, 'yaVerificado': true}),
      );

      final resultado = await fuenteCon(adaptador).reenviar();

      final peticion = adaptador.peticiones.single;
      expect(peticion.path, '/cuentas/verificacion/reenviar');
      expect(peticion.data, isNull);
      expect(resultado, (enviado: false, yaVerificado: true));
    });

    test('el límite de reenvíos llega como DEMASIADOS_INTENTOS', () async {
      final adaptador = AdaptadorHttpFalso(
        (_) => respuestaError(
          429,
          'DEMASIADOS_INTENTOS',
          'Hiciste demasiados intentos. Espera unos minutos y vuelve a '
              'probar.',
        ),
      );

      await expectLater(
        fuenteCon(adaptador).reenviar(),
        throwsA(isA<ErrorApi>().having((e) => e.estadoHttp, 'estadoHttp', 429)),
      );
    });
  });

  group('EstadoSesion.marcarCorreoVerificado', () {
    test(
      'marca el correo verificado, conserva los tokens y lo guarda',
      () async {
        final almacen = AlmacenSesionEnMemoria(sesionDeEjemplo);
        final contenedor = crearContenedor(almacen: almacen);
        await contenedor.read(sesionProvider.future);

        await contenedor.read(sesionProvider.notifier).marcarCorreoVerificado();

        final sesion = contenedor.read(sesionProvider).value!;
        expect(sesion.estudiante.correoVerificado, isTrue);
        expect(sesion.estudiante.id, 15);
        expect(sesion.tokenAcceso, 'acceso');
        expect(almacen.guardada?.estudiante.correoVerificado, isTrue);
      },
    );

    test('si ya estaba verificado, no cambia nada', () async {
      final verificada = sesionDeEjemplo.conCorreoVerificado();
      final contenedor = crearContenedor(sesion: verificada);
      await contenedor.read(sesionProvider.future);

      await contenedor.read(sesionProvider.notifier).marcarCorreoVerificado();

      expect(contenedor.read(sesionProvider).value, same(verificada));
    });

    test('sin sesión no hace nada', () async {
      final almacen = AlmacenSesionEnMemoria();
      final contenedor = crearContenedor(almacen: almacen);
      await contenedor.read(sesionProvider.future);

      await contenedor.read(sesionProvider.notifier).marcarCorreoVerificado();

      expect(contenedor.read(sesionProvider).value, isNull);
      expect(almacen.guardada, isNull);
    });

    test('una renovación posterior conserva el correo verificado', () async {
      final almacen = AlmacenSesionEnMemoria(sesionDeEjemplo);
      final contenedor = crearContenedor(almacen: almacen);
      await contenedor.read(sesionProvider.future);
      final notificador = contenedor.read(sesionProvider.notifier);

      await notificador.marcarCorreoVerificado();
      await notificador.renovar();

      final sesion = contenedor.read(sesionProvider).value!;
      expect(sesion.tokenAcceso, 'acceso-1');
      expect(sesion.estudiante.correoVerificado, isTrue);
      expect(almacen.guardada?.estudiante.correoVerificado, isTrue);
    });
  });

  group('repositorioVerificacionProvider', () {
    test('las rutas de verificación llevan el token de la sesión', () async {
      final contenedor = crearContenedor(sesion: sesionDeEjemplo);
      await contenedor.read(sesionProvider.future);
      final adaptador = AdaptadorHttpFalso(
        (_) => respuestaOk({'enviado': true, 'yaVerificado': false}),
      );
      contenedor.read(clienteHttpConSesionProvider).httpClientAdapter =
          adaptador;

      await contenedor.read(repositorioVerificacionProvider).reenviar();

      expect(
        adaptador.peticiones.single.headers['Authorization'],
        'Bearer acceso',
      );
    });

    test(
      'con el token vencido, renueva la sesión y repite la petición',
      () async {
        final repositorio = RepositorioCuentasFalso();
        final almacen = AlmacenSesionEnMemoria(sesionDeEjemplo);
        final contenedor = crearContenedor(
          repositorio: repositorio,
          almacen: almacen,
        );
        await contenedor.read(sesionProvider.future);
        // La API rechaza el token guardado y acepta el de la renovación.
        final adaptador = AdaptadorHttpFalso(
          (opciones) => opciones.headers['Authorization'] == 'Bearer acceso-1'
              ? respuestaOk({'verificado': true, 'yaVerificado': false})
              : respuestaError(
                  401,
                  'NO_AUTENTICADO',
                  'La sesión no es válida o venció.',
                ),
        );
        contenedor.read(clienteHttpConSesionProvider).httpClientAdapter =
            adaptador;
        contenedor.read(clienteHttpProvider).httpClientAdapter = adaptador;

        await contenedor
            .read(repositorioVerificacionProvider)
            .verificarCodigo('194987');

        expect(repositorio.renovaciones, ['renovacion']);
        expect(adaptador.peticiones.map((p) => p.headers['Authorization']), [
          'Bearer acceso',
          'Bearer acceso-1',
        ]);
        expect(almacen.guardada?.tokenAcceso, 'acceso-1');
      },
    );
  });

  group('Pantalla Verificar correo (A06)', () {
    late RepositorioVerificacionFalso verificacion;
    late AlmacenSesionEnMemoria almacen;
    late ProviderContainer contenedor;

    setUp(() {
      verificacion = RepositorioVerificacionFalso();
      almacen = AlmacenSesionEnMemoria(sesionDeEjemplo);
    });

    Future<void> abrir(WidgetTester tester) async {
      contenedor = crearContenedor(
        verificacion: verificacion,
        almacen: almacen,
      );
      await iniciarApp(tester, contenedor, ruta: Rutas.verificarCorreo);
    }

    Finder campoCodigo() => campo('Código de 6 dígitos');

    Future<void> escribirYVerificar(WidgetTester tester, String codigo) async {
      await tester.enterText(campoCodigo(), codigo);
      await tocar(tester, find.widgetWithText(FilledButton, 'Verificar'));
    }

    bool campoActivo(WidgetTester tester) =>
        tester.widget<TextField>(campoCodigo()).enabled!;

    testWidgets('explica el beneficio y muestra el correo', (tester) async {
      await abrir(tester);

      expect(find.text('Verifica tu correo'), findsOne);
      expect(find.text('10 preguntas'), findsOne);
      expect(find.text('20 preguntas'), findsOne);
      expect(find.textContaining('camila@ejemplo.cl'), findsOne);
      expect(find.textContaining('vencen en 24 horas'), findsOne);
      expect(find.textContaining('5 intentos'), findsOne);
    });

    testWidgets('un código de menos de 6 dígitos no se envía', (tester) async {
      await abrir(tester);
      await escribirYVerificar(tester, '1234');

      expect(find.text('El código tiene 6 dígitos.'), findsOne);
      expect(verificacion.codigos, isEmpty);
    });

    testWidgets('el campo solo acepta dígitos y los muestra en las casillas', (
      tester,
    ) async {
      await abrir(tester);
      await tester.enterText(campoCodigo(), '12a4b6');
      await tester.pump();

      expect(tester.widget<TextField>(campoCodigo()).controller!.text, '1246');
      for (final digito in ['1', '2', '4', '6']) {
        expect(find.text(digito), findsOne);
      }
    });

    testWidgets('con el código correcto verifica la cuenta y la guarda', (
      tester,
    ) async {
      await abrir(tester);
      await escribirYVerificar(tester, '194987');

      expect(verificacion.codigos, ['194987']);
      expect(find.text('¡Listo! Tu correo está verificado.'), findsOne);
      expect(almacen.guardada?.estudiante.correoVerificado, isTrue);

      await tocar(tester, find.widgetWithText(FilledButton, 'Ir a Inicio'));
      expect(rutaActual(contenedor), Rutas.inicio);
    });

    testWidgets('un código incorrecto muestra los intentos que quedan (A06b)', (
      tester,
    ) async {
      verificacion.erroresAlVerificar.add(_codigoIncorrecto);
      await abrir(tester);
      await escribirYVerificar(tester, '000000');

      expect(
        find.text('El código no es correcto. Te quedan 4 intentos.'),
        findsOne,
      );
      expect(campoActivo(tester), isTrue);
      expect(almacen.guardada?.estudiante.correoVerificado, isFalse);

      // Al corregir el código, el mensaje se borra.
      await tester.enterText(campoCodigo(), '19498');
      await tester.pumpAndSettle();
      expect(
        find.text('El código no es correcto. Te quedan 4 intentos.'),
        findsNothing,
      );
    });

    testWidgets('con el código agotado pide un correo nuevo (A06c)', (
      tester,
    ) async {
      verificacion.erroresAlVerificar.add(_codigoAgotado);
      await abrir(tester);
      await escribirYVerificar(tester, '000000');

      expect(find.text(_codigoAgotado.mensaje), findsOne);
      expect(campoActivo(tester), isFalse);
      expect(find.widgetWithText(FilledButton, 'Verificar'), findsNothing);

      // Pedir un correo nuevo vuelve a activar el código.
      await tocar(
        tester,
        find.widgetWithText(FilledButton, 'Enviar un correo nuevo'),
      );
      expect(verificacion.reenvios, 1);
      expect(find.textContaining('Te enviamos un correo nuevo'), findsOne);
      expect(find.text(_codigoAgotado.mensaje), findsNothing);
      expect(campoActivo(tester), isTrue);
    });

    testWidgets('si al reenviar ya estaba verificado, lo muestra', (
      tester,
    ) async {
      verificacion.resultadoReenvio = (enviado: false, yaVerificado: true);
      await abrir(tester);
      await tocar(tester, find.widgetWithText(TextButton, 'Reenviar correo'));

      expect(find.text('¡Listo! Tu correo está verificado.'), findsOne);
      expect(almacen.guardada?.estudiante.correoVerificado, isTrue);
    });

    testWidgets('el límite de reenvíos muestra el aviso de la API', (
      tester,
    ) async {
      verificacion.errorAlReenviar = const ErrorApi(
        codigo: 'DEMASIADOS_INTENTOS',
        mensaje:
            'Hiciste demasiados intentos. Espera unos minutos y vuelve a '
            'probar.',
        estadoHttp: 429,
      );
      await abrir(tester);
      await tocar(tester, find.widgetWithText(TextButton, 'Reenviar correo'));

      expect(find.textContaining('Hiciste demasiados intentos'), findsOne);
    });

    testWidgets('«‹ Inicio» deja verificar más tarde', (tester) async {
      await abrir(tester);
      await tocar(tester, find.byIcon(Icons.chevron_left));

      expect(rutaActual(contenedor), Rutas.inicio);
      expect(verificacion.codigos, isEmpty);
    });

    testWidgets('con el correo ya verificado no pide el código', (
      tester,
    ) async {
      almacen = AlmacenSesionEnMemoria(sesionDeEjemplo.conCorreoVerificado());
      await abrir(tester);

      expect(find.text('¡Listo! Tu correo está verificado.'), findsOne);
      expect(campoCodigo(), findsNothing);
    });
  });

  group('Aviso de correo sin verificar en Inicio', () {
    const textoAviso =
        'Verifica tu correo y sube tu cupo a 20 preguntas diarias.';

    testWidgets('aparece mientras el correo no esté verificado', (
      tester,
    ) async {
      await iniciarApp(
        tester,
        crearContenedor(sesion: sesionDeEjemplo),
        ruta: Rutas.inicio,
      );

      expect(find.text(textoAviso), findsOne);
    });

    testWidgets('no aparece con el correo verificado', (tester) async {
      await iniciarApp(
        tester,
        crearContenedor(sesion: sesionDeEjemplo.conCorreoVerificado()),
        ruta: Rutas.inicio,
      );

      expect(find.text(textoAviso), findsNothing);
    });

    testWidgets('lleva a verificar y desaparece al volver verificado', (
      tester,
    ) async {
      final verificacion = RepositorioVerificacionFalso();
      final contenedor = crearContenedor(
        verificacion: verificacion,
        sesion: sesionDeEjemplo,
      );
      await iniciarApp(tester, contenedor, ruta: Rutas.inicio);

      await tocar(tester, find.widgetWithText(FilledButton, 'Verificar'));
      expect(rutaActual(contenedor), Rutas.verificarCorreo);

      await tester.enterText(campo('Código de 6 dígitos'), '194987');
      await tocar(tester, find.widgetWithText(FilledButton, 'Verificar'));
      expect(find.text('¡Listo! Tu correo está verificado.'), findsOne);

      // Se abrió encima de Inicio: «‹ Inicio» vuelve, ya sin el aviso.
      await tocar(tester, find.byIcon(Icons.chevron_left));
      expect(rutaActual(contenedor), Rutas.inicio);
      expect(find.text(textoAviso), findsNothing);
    });
  });
}
