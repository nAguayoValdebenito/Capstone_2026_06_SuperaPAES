import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:supera_paes/datos/fuentes/fuente_mis_datos_remota.dart';
import 'package:supera_paes/datos/modelos/mis_datos_modelo.dart';
import 'package:supera_paes/dominio/entidades/archivo_mis_datos.dart';
import 'package:supera_paes/dominio/entidades/suscripcion_vigente.dart';
import 'package:supera_paes/nucleo/constantes.dart';
import 'package:supera_paes/nucleo/errores.dart';
import 'package:supera_paes/presentacion/comunes/estado_cuenta.dart';

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

    test('pide la suscripción con GET y borra con DELETE en '
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
                }
              : {'eliminadaEn': '2026-10-30T18:00:00.000Z'},
        ),
      );
      final fuente = FuenteMisDatosRemota(Dio()..httpClientAdapter = adaptador);

      final suscripcion = await fuente.suscripcionVigente();
      await fuente.borrarCuenta();

      expect(suscripcion?.tienda, Tienda.googlePlay);
      expect(suscripcion?.enMora, isFalse);
      expect(
        [for (final p in adaptador.peticiones) '${p.method} ${p.path}'],
        ['GET /privacidad/cuenta', 'DELETE /privacidad/cuenta'],
      );
    });
  });

  group('Borrar mi cuenta (A42)', () {
    testWidgets('Mis datos abre A42, que explica qué se borra y pide la '
        'casilla; «Cancelar» vuelve sin borrar (CU-14 5.a)', (tester) async {
      final repo = RepositorioMisDatosFalso();
      final contenedor = crearContenedor(
        sesion: sesionDeEjemplo,
        misDatos: repo,
      );
      await iniciarApp(tester, contenedor, ruta: Rutas.misDatos);

      await tocar(tester, find.text('Borrar mi cuenta'));

      expect(rutaActual(contenedor), Rutas.borrarCuenta);
      expect(find.text('¿Borrar tu cuenta?'), findsOne);
      expect(find.textContaining('quedan seudonimizadas'), findsOne);
      expect(find.textContaining('Tienes una suscripción'), findsNothing);
      expect(
        find.text('Entiendo que debo cancelarla en la tienda'),
        findsNothing,
      );
      expect(_sePuedeBorrar(tester), isFalse);

      await tocar(
        tester,
        find.text('Entiendo que perderé mi historial y mi progreso.'),
      );
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

      await tocar(
        tester,
        find.text('Entiendo que perderé mi historial y mi progreso.'),
      );
      await tester.tap(find.widgetWithText(FilledButton, 'Borrar mi cuenta'));
      await tester.pumpAndSettle();

      expect(repo.borrados, 1);
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

      await tocar(
        tester,
        find.text('Entiendo que perderé mi historial y mi progreso.'),
      );
      await tester.tap(find.widgetWithText(FilledButton, 'Borrar mi cuenta'));
      await tester.pumpAndSettle();

      expect(find.text('No hay conexión con el servidor.'), findsOne);
      expect(rutaActual(contenedor), Rutas.borrarCuenta);
      expect(contenedor.read(sesionProvider).value, isNotNull);
      expect(_sePuedeBorrar(tester), isTrue);
    });

    testWidgets('«descargar tus datos» entrega el archivo antes de borrar '
        '(CU-14 paso 4)', (tester) async {
      final compartidos = <ArchivoMisDatos>[];
      await iniciarApp(
        tester,
        crearContenedor(
          sesion: sesionDeEjemplo,
          compartir: (archivo) async => compartidos.add(archivo),
        ),
        ruta: Rutas.borrarCuenta,
      );

      await tocar(tester, find.textContaining('descargar tus datos'));

      expect(compartidos, [archivoDePrueba]);
    });
  });

  group('Borrar mi cuenta con una suscripción vigente (A42b)', () {
    testWidgets('avisa que la tienda sigue cobrando, abre su gestión y pide '
        'las dos casillas (RN-34)', (tester) async {
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
        find.textContaining(
          '(Todas las pruebas, mensual, Google Play). Google Play seguirá '
          'cobrando hasta que la canceles en la tienda',
        ),
        findsOne,
      );
      await tocar(tester, find.text('Abrir mis suscripciones en Google Play'));
      expect(abiertos, [
        Uri.parse('https://play.google.com/store/account/subscriptions'),
      ]);

      await tocar(
        tester,
        find.text('Entiendo que perderé mi historial y mi progreso.'),
      );
      expect(_sePuedeBorrar(tester), isFalse);
      await tocar(
        tester,
        find.text('Entiendo que debo cancelarla en la tienda'),
      );
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
        find.text('Entiendo que perderé mi historial y mi progreso.'),
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

      expect(find.textContaining('(Una prueba, anual, App Store)'), findsOne);
      await tocar(tester, find.text('Abrir mis suscripciones en App Store'));

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
        ..errorSuscripcion = _sinConexion;
      await iniciarApp(
        tester,
        crearContenedor(sesion: sesionDeEjemplo, misDatos: repo),
        ruta: Rutas.borrarCuenta,
      );

      expect(find.text('No hay conexión con el servidor.'), findsOne);
      await tocar(
        tester,
        find.text('Entiendo que perderé mi historial y mi progreso.'),
      );
      expect(_sePuedeBorrar(tester), isFalse);

      repo.errorSuscripcion = null;
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
