import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:supera_paes/datos/fuentes/fuente_mis_datos_remota.dart';
import 'package:supera_paes/datos/modelos/mis_datos_modelo.dart';
import 'package:supera_paes/dominio/entidades/archivo_mis_datos.dart';
import 'package:supera_paes/dominio/entidades/documento_legal.dart';
import 'package:supera_paes/dominio/entidades/suscripcion_vigente.dart';
import 'package:supera_paes/nucleo/constantes.dart';
import 'package:supera_paes/nucleo/errores.dart';
import 'package:supera_paes/nucleo/interceptor_sesion.dart';
import 'package:supera_paes/presentacion/comunes/componentes.dart';
import 'package:supera_paes/presentacion/comunes/estado_cuenta.dart';
import 'package:supera_paes/presentacion/mis_datos/hoja_contrasena.dart';

import 'apoyo/adaptador_http_falso.dart';
import 'apoyo/app_de_prueba.dart';
import 'apoyo/repositorio_cuentas_falso.dart';
import 'apoyo/repositorio_mis_datos_falso.dart';

const _sinConexion = ErrorApi(
  codigo: 'SIN_CONEXION',
  mensaje: 'No hay conexión con el servidor.',
);

/// ¿Se puede tocar «Borrar mi cuenta»?
bool _sePuedeBorrar(WidgetTester tester) =>
    tester
        .widget<FilledButton>(
          find.widgetWithText(FilledButton, 'Borrar mi cuenta'),
        )
        .onPressed !=
    null;

/// Escribe la contraseña que confirma el borrado; la lista construye lo que
/// se ve, así que primero llega hasta el campo.
Future<void> _escribirContrasena(WidgetTester tester, String texto) async {
  final campo = find.descendant(
    of: find.byType(CampoContrasena),
    matching: find.byType(TextField),
  );
  await tester.scrollUntilVisible(
    campo,
    200,
    scrollable: find.byType(Scrollable).first,
  );
  await tester.enterText(campo, texto);
  await tester.pump();
}

void main() {
  group('Suscripción vigente y borrado en la API', () {
    test('lee la suscripción de /privacidad/cuenta, o null sin una', () {
      expect(MisDatosModelo.suscripcion({'suscripcionVigente': null}), isNull);

      final enMora = MisDatosModelo.suscripcion({
        'suscripcionVigente': {
          'estado': 'en_mora',
          'plan': 'Una prueba',
          'periodicidad': 'anual',
          'tienda': 'app_store',
        },
      })!;

      expect(enMora.enMora, isTrue);
      expect(enMora.plan, 'Una prueba');
      expect(enMora.periodicidad, 'anual');
      expect(enMora.tienda, Tienda.appStore);
    });

    test('pide el estado de la cuenta con GET y borra con DELETE en '
        '/privacidad/cuenta', () async {
      final adaptador = AdaptadorHttpFalso(
        (peticion) => respuestaOk(
          peticion.method == 'GET'
              ? {
                  'suscripcionVigente': {
                    'estado': 'activa',
                    'plan': 'Todas las pruebas',
                    'periodicidad': 'mensual',
                    'tienda': 'google_play',
                  },
                  'documentosAceptados': [
                    {
                      'documento': 'terminos',
                      'version': '1.0',
                      'aceptadoEn': '2026-10-21T21:00:00.000Z',
                    },
                    // Un tipo que la app no conoce se omite.
                    {
                      'documento': 'otro',
                      'version': '1.0',
                      'aceptadoEn': '2026-10-21T21:00:00.000Z',
                    },
                  ],
                }
              : {'eliminadaEn': '2026-10-30T18:00:00.000Z'},
        ),
      );
      final fuente = FuenteMisDatosRemota(Dio()..httpClientAdapter = adaptador);

      final estado = await fuente.estadoDeLaCuenta();
      await fuente.borrarCuenta('clave-secreta');

      expect(estado.suscripcionVigente?.tienda, Tienda.googlePlay);
      expect(estado.suscripcionVigente?.enMora, isFalse);
      expect(
        estado.documentosAceptados.single.tipo,
        TipoDocumentoLegal.terminos,
      );
      expect(estado.documentosAceptados.single.version, '1.0');
      expect(
        [for (final p in adaptador.peticiones) '${p.method} ${p.path}'],
        ['GET /privacidad/cuenta', 'DELETE /privacidad/cuenta'],
      );
      // El borrado lleva la contraseña en el cuerpo y no renueva la sesión
      // si la API la rechaza.
      final borrado = adaptador.peticiones.last;
      expect(borrado.data, {'contrasena': 'clave-secreta'});
      expect(borrado.extra[InterceptorSesion.confirmaContrasena], isTrue);
    });

    test('al borrar con la contraseña incorrecta entrega el 401, y tras 5 '
        'intentos, el 429', () async {
      var estado = 401;
      final fuente = FuenteMisDatosRemota(
        Dio()
          ..httpClientAdapter = AdaptadorHttpFalso(
            (_) => estado == 401
                ? respuestaError(401, 'NO_AUTENTICADO', contrasenaIncorrecta)
                : respuestaError(
                    429,
                    'DEMASIADOS_INTENTOS',
                    'Demasiados intentos. Espera unos minutos.',
                  ),
          ),
      );

      await expectLater(
        fuente.borrarCuenta('otra'),
        throwsA(
          isA<ErrorApi>()
              .having((e) => e.estadoHttp, 'estado', 401)
              .having((e) => e.mensaje, 'mensaje', contrasenaIncorrecta),
        ),
      );
      estado = 429;
      await expectLater(
        fuente.borrarCuenta('otra'),
        throwsA(
          isA<ErrorApi>()
              .having((e) => e.estadoHttp, 'estado', 429)
              .having((e) => e.codigo, 'código', 'DEMASIADOS_INTENTOS'),
        ),
      );
    });
  });

  group('Borrar mi cuenta (A42)', () {
    testWidgets('Mis datos abre A42, que explica qué se borra; «Cancelar» '
        'vuelve sin borrar (CU-14 5.a)', (tester) async {
      final repo = RepositorioMisDatosFalso();
      final contenedor = crearContenedor(
        sesion: sesionDeEjemplo,
        misDatos: repo,
      );
      await iniciarApp(tester, contenedor, ruta: Rutas.misDatos);

      await tocar(tester, find.text('Borrar mi cuenta'));

      expect(rutaActual(contenedor), Rutas.borrarCuenta);
      expect(find.text('Borrar mi cuenta'), findsWidgets);
      expect(
        find.textContaining('quedarán sin datos que te identifiquen'),
        findsOne,
      );
      expect(find.textContaining('Tienes una suscripción'), findsNothing);
      expect(
        find.text('Entiendo que debo cancelarla en la tienda'),
        findsNothing,
      );
      // Sin suscripción, la contraseña y «Borrar mi cuenta» confirman (A42).
      expect(_sePuedeBorrar(tester), isFalse);
      await _escribirContrasena(tester, 'clave-secreta');
      expect(_sePuedeBorrar(tester), isTrue);

      await tester.tap(find.text('Cancelar'));
      await tester.pumpAndSettle();
      expect(rutaActual(contenedor), Rutas.misDatos);
      expect(repo.borrados, 0);
    });

    testWidgets('al borrar, cierra la sesión y vuelve al ingreso '
        '(CU-14 paso 6)', (tester) async {
      final repo = RepositorioMisDatosFalso();
      final almacen = AlmacenSesionEnMemoria(sesionDeEjemplo);
      final contenedor = crearContenedor(misDatos: repo, almacen: almacen);
      await iniciarApp(tester, contenedor, ruta: Rutas.borrarCuenta);

      await _escribirContrasena(tester, 'clave-secreta');
      await tester.tap(find.widgetWithText(FilledButton, 'Borrar mi cuenta'));
      await tester.pumpAndSettle();

      expect(repo.borrados, 1);
      expect(repo.contrasenas, ['clave-secreta']);
      expect(contenedor.read(sesionProvider).value, isNull);
      expect(await almacen.leer(), isNull);
      expect(rutaActual(contenedor), Rutas.ingreso);
      expect(find.text('Tu cuenta se borró.'), findsOne);
    });

    testWidgets('si el borrado falla, lo dice y la sesión sigue abierta', (
      tester,
    ) async {
      final repo = RepositorioMisDatosFalso()..errorBorrado = _sinConexion;
      final contenedor = crearContenedor(
        sesion: sesionDeEjemplo,
        misDatos: repo,
      );
      await iniciarApp(tester, contenedor, ruta: Rutas.borrarCuenta);

      await _escribirContrasena(tester, 'clave-secreta');
      await tester.tap(find.widgetWithText(FilledButton, 'Borrar mi cuenta'));
      await tester.pumpAndSettle();

      expect(find.text('No hay conexión con el servidor.'), findsOne);
      expect(rutaActual(contenedor), Rutas.borrarCuenta);
      expect(contenedor.read(sesionProvider).value, isNotNull);
      expect(_sePuedeBorrar(tester), isTrue);
    });

    testWidgets('con la contraseña incorrecta (401), lo dice bajo el campo, '
        'no borra y la sesión sigue abierta', (tester) async {
      final repo = RepositorioMisDatosFalso()
        ..errorBorrado = const ErrorApi(
          codigo: 'NO_AUTENTICADO',
          mensaje: contrasenaIncorrecta,
          estadoHttp: 401,
        );
      final almacen = AlmacenSesionEnMemoria(sesionDeEjemplo);
      final contenedor = crearContenedor(misDatos: repo, almacen: almacen);
      await iniciarApp(tester, contenedor, ruta: Rutas.borrarCuenta);

      await _escribirContrasena(tester, 'otra');
      await tester.tap(find.widgetWithText(FilledButton, 'Borrar mi cuenta'));
      await tester.pumpAndSettle();

      expect(
        find.descendant(
          of: find.byType(CampoContrasena),
          matching: find.text(contrasenaIncorrecta),
        ),
        findsOne,
      );
      expect(repo.borrados, 0);
      expect(rutaActual(contenedor), Rutas.borrarCuenta);
      expect(contenedor.read(sesionProvider).value, isNotNull);
      expect(await almacen.leer(), isNotNull);
      expect(find.text('Tu cuenta se borró.'), findsNothing);

      // Con la correcta, borra.
      repo.errorBorrado = null;
      await _escribirContrasena(tester, 'clave-secreta');
      expect(find.text(contrasenaIncorrecta), findsNothing);
      await tester.tap(find.widgetWithText(FilledButton, 'Borrar mi cuenta'));
      await tester.pumpAndSettle();
      expect(repo.borrados, 1);
      expect(rutaActual(contenedor), Rutas.ingreso);
    });

    testWidgets('después de 5 intentos fallidos (429), pide esperar unos '
        'minutos', (tester) async {
      final repo = RepositorioMisDatosFalso()
        ..errorBorrado = const ErrorApi(
          codigo: 'DEMASIADOS_INTENTOS',
          mensaje: 'Demasiados intentos.',
          estadoHttp: 429,
        );
      final contenedor = crearContenedor(
        sesion: sesionDeEjemplo,
        misDatos: repo,
      );
      await iniciarApp(tester, contenedor, ruta: Rutas.borrarCuenta);

      await _escribirContrasena(tester, 'otra');
      await tester.tap(find.widgetWithText(FilledButton, 'Borrar mi cuenta'));
      await tester.pumpAndSettle();

      expect(find.text(demasiadosIntentosContrasena), findsOne);
      expect(repo.borrados, 0);
      expect(contenedor.read(sesionProvider).value, isNotNull);
    });

    testWidgets(
      '«Descargar mis datos primero» entrega el archivo antes de borrar '
      '(CU-14 paso 4)',
      (tester) async {
        final compartidos = <ArchivoMisDatos>[];
        final repo = RepositorioMisDatosFalso();
        await iniciarApp(
          tester,
          crearContenedor(
            sesion: sesionDeEjemplo,
            misDatos: repo,
            compartir: (archivo) async => compartidos.add(archivo),
          ),
          ruta: Rutas.borrarCuenta,
        );

        await tocar(tester, find.text('Descargar mis datos primero'));
        // La descarga pide la contraseña en su propia hoja.
        final hoja = find.byType(HojaContrasena<ArchivoMisDatos>);
        expect(hoja, findsOne);
        await tester.enterText(
          find.descendant(of: hoja, matching: find.byType(TextField)),
          'clave-secreta',
        );
        await tester.pump();
        await tester.tap(find.widgetWithText(FilledButton, 'Descargar'));
        await tester.pumpAndSettle();

        expect(repo.contrasenas, ['clave-secreta']);
        expect(compartidos, [archivoDePrueba]);
        expect(repo.borrados, 0);
      },
    );
  });

  group('Borrar mi cuenta con una suscripción vigente (A42b)', () {
    testWidgets('avisa que la tienda sigue cobrando, abre su gestión y pide '
        'la casilla (RN-34)', (tester) async {
      final abiertos = <Uri>[];
      final repo = RepositorioMisDatosFalso(suscripcion: suscripcionDePrueba);
      await iniciarApp(
        tester,
        crearContenedor(
          sesion: sesionDeEjemplo,
          misDatos: repo,
          abrirEnlace: (enlace) async {
            abiertos.add(enlace);
            return true;
          },
        ),
        ruta: Rutas.borrarCuenta,
      );

      expect(
        find.text(
          'Tienes una suscripción activa. Si borras tu cuenta, la tienda '
          'seguirá cobrando hasta que la canceles en Google Play o en la App '
          'Store.',
        ),
        findsOne,
      );
      await tocar(tester, find.text('Abrir suscripciones de la tienda'));
      expect(abiertos, [
        Uri.parse('https://play.google.com/store/account/subscriptions'),
      ]);

      expect(_sePuedeBorrar(tester), isFalse);
      await tocar(
        tester,
        find.text('Entiendo que debo cancelarla en la tienda'),
      );
      // Falta la contraseña.
      expect(_sePuedeBorrar(tester), isFalse);
      await _escribirContrasena(tester, 'clave-secreta');
      expect(_sePuedeBorrar(tester), isTrue);

      // Se puede borrar aunque siga vigente (RN-34).
      await tester.tap(find.widgetWithText(FilledButton, 'Borrar mi cuenta'));
      await tester.pumpAndSettle();
      expect(repo.borrados, 1);
    });

    testWidgets('con la letra al doble no se desborda (RNF-12)', (
      tester,
    ) async {
      tester.platformDispatcher.textScaleFactorTestValue = 2;
      addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);

      await iniciarApp(
        tester,
        crearContenedor(
          sesion: sesionDeEjemplo,
          misDatos: RepositorioMisDatosFalso(suscripcion: suscripcionDePrueba),
        ),
        ruta: Rutas.borrarCuenta,
      );
      await tester.scrollUntilVisible(
        find.text('Entiendo que debo cancelarla en la tienda'),
        200,
        scrollable: find.byType(Scrollable).first,
      );

      expect(tester.takeException(), isNull);
    });

    testWidgets('en mora en la App Store abre la gestión de Apple; si no '
        'abre, lo avisa', (tester) async {
      final abiertos = <Uri>[];
      await iniciarApp(
        tester,
        crearContenedor(
          sesion: sesionDeEjemplo,
          misDatos: RepositorioMisDatosFalso(
            suscripcion: const SuscripcionVigente(
              enMora: true,
              plan: 'Una prueba',
              periodicidad: 'anual',
              tienda: Tienda.appStore,
            ),
          ),
          abrirEnlace: (enlace) async {
            abiertos.add(enlace);
            return false;
          },
        ),
        ruta: Rutas.borrarCuenta,
      );

      expect(find.textContaining('Tienes una suscripción en mora.'), findsOne);
      await tocar(tester, find.text('Abrir suscripciones de la tienda'));

      expect(abiertos, [
        Uri.parse('https://apps.apple.com/account/subscriptions'),
      ]);
      expect(
        find.text(
          'No se pudo abrir App Store. Cancela la suscripción desde la app '
          'de la tienda.',
        ),
        findsOne,
      );
    });

    testWidgets('si no se pudo revisar la suscripción, no deja borrar hasta '
        'reintentar', (tester) async {
      final repo = RepositorioMisDatosFalso(suscripcion: suscripcionDePrueba)
        ..errorEstado = _sinConexion;
      await iniciarApp(
        tester,
        crearContenedor(sesion: sesionDeEjemplo, misDatos: repo),
        ruta: Rutas.borrarCuenta,
      );

      expect(find.text('No hay conexión con el servidor.'), findsOne);
      expect(_sePuedeBorrar(tester), isFalse);

      repo.errorEstado = null;
      await tocar(tester, find.text('Reintentar'));

      // La lista construye lo que se ve: hay que llegar hasta la casilla.
      final casillaTienda = find.text(
        'Entiendo que debo cancelarla en la tienda',
      );
      await tester.scrollUntilVisible(
        casillaTienda,
        200,
        scrollable: find.byType(Scrollable).first,
      );
      expect(casillaTienda, findsOne);
      expect(_sePuedeBorrar(tester), isFalse);
    });
  });
}
