import 'dart:async';
import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:supera_paes/datos/fuentes/fuente_mis_datos_remota.dart';
import 'package:supera_paes/datos/modelos/mis_datos_modelo.dart';
import 'package:supera_paes/dominio/entidades/archivo_mis_datos.dart';
import 'package:supera_paes/nucleo/constantes.dart';
import 'package:supera_paes/nucleo/errores.dart';
import 'package:supera_paes/presentacion/comunes/componentes.dart';

import 'apoyo/adaptador_http_falso.dart';
import 'apoyo/app_de_prueba.dart';
import 'apoyo/repositorio_cuentas_falso.dart';
import 'apoyo/repositorio_mis_datos_falso.dart';

/// Lo esencial de la respuesta de /privacidad/mis-datos (docs/contratos/HU-07.md).
const Map<String, dynamic> _misDatosJson = {
  'generadoEn': '2026-10-29T15:00:00.000Z',
  'cuenta': {'id': 84, 'nombre': 'Ana', 'correo': 'ana@ejemplo.cl'},
  'consentimientos': <Object?>[],
  'evaluaciones': <Object?>[],
  'puntajes': <Object?>[],
};

void main() {
  group('Archivo de mis datos', () {
    test('lleva el JSON del servidor con sangría y la fecha en el nombre', () {
      final archivo = MisDatosModelo.archivo(_misDatosJson);

      expect(archivo.nombre, 'supera-paes-mis-datos-2026-10-29.json');
      expect(archivo.contenido, contains('\n  "cuenta": {\n    "id": 84,'));
      expect(jsonDecode(archivo.contenido), _misDatosJson);
    });

    test(
      'FuenteMisDatosRemota los pide con GET a /privacidad/mis-datos',
      () async {
        final adaptador = AdaptadorHttpFalso((_) => respuestaOk(_misDatosJson));

        final archivo = await FuenteMisDatosRemota(
          Dio()..httpClientAdapter = adaptador,
        ).descargar();

        expect(adaptador.peticiones.single.method, 'GET');
        expect(adaptador.peticiones.single.path, '/privacidad/mis-datos');
        expect(jsonDecode(archivo.contenido), _misDatosJson);
      },
    );
  });

  group('Mis datos y privacidad (A39)', () {
    testWidgets('Perfil abre A39 con la descarga y los puntajes', (
      tester,
    ) async {
      final contenedor = crearContenedor(sesion: sesionDeEjemplo);
      await iniciarApp(tester, contenedor, ruta: Rutas.perfil);

      await tocar(tester, find.text('Mis datos y privacidad'));

      expect(rutaActual(contenedor), Rutas.misDatos);
      expect(find.text('Descargar mis datos'), findsOne);
      expect(
        find.text(
          'Tu cuenta, perfil, historial, respuestas, resultados y puntajes '
          'en un archivo.',
        ),
        findsOne,
      );
      expect(find.text('Sin permiso · opcional'), findsOne);
      expect(find.text('Borrar mi cuenta'), findsOne);
      expect(find.text('Esta acción no se puede deshacer.'), findsOne);
      // Llega con HU-09.
      expect(find.text('Solicitudes sobre mis datos'), findsNothing);

      // «Perfil» también es una pestaña de la barra inferior.
      await tocar(
        tester,
        find.descendant(
          of: find.byType(EnlaceVolver),
          matching: find.text('Perfil'),
        ),
      );
      expect(rutaActual(contenedor), Rutas.perfil);
    });

    testWidgets('«Descargar mis datos» entrega el archivo en el menú '
        'Compartir (CU-14 3.a)', (tester) async {
      final repo = RepositorioMisDatosFalso();
      final compartidos = <ArchivoMisDatos>[];
      final menu = Completer<void>();
      await iniciarApp(
        tester,
        crearContenedor(
          sesion: sesionDeEjemplo,
          misDatos: repo,
          compartir: (archivo) {
            compartidos.add(archivo);
            return menu.future;
          },
        ),
        ruta: Rutas.misDatos,
      );

      await tester.tap(find.text('Descargar mis datos'));
      await tester.pump();

      expect(compartidos, [archivoDePrueba]);
      expect(find.text('Preparando tu archivo…'), findsOne);
      // Con el menú abierto, otro toque no la vuelve a pedir.
      await tester.tap(find.text('Descargar mis datos'));
      await tester.pump();
      expect(repo.descargas, 1);

      menu.complete();
      await tester.pumpAndSettle();
      expect(find.text('Preparando tu archivo…'), findsNothing);
    });

    testWidgets('si la descarga falla, muestra el error y se puede volver a '
        'intentar', (tester) async {
      final repo = RepositorioMisDatosFalso()
        ..error = const ErrorApi(
          codigo: 'SIN_CONEXION',
          mensaje: 'No hay conexión con el servidor.',
        );
      final compartidos = <ArchivoMisDatos>[];
      await iniciarApp(
        tester,
        crearContenedor(
          sesion: sesionDeEjemplo,
          misDatos: repo,
          compartir: (archivo) async => compartidos.add(archivo),
        ),
        ruta: Rutas.misDatos,
      );

      await tocar(tester, find.text('Descargar mis datos'));
      expect(find.text('No hay conexión con el servidor.'), findsOne);
      expect(compartidos, isEmpty);

      repo.error = null;
      await tocar(tester, find.text('Descargar mis datos'));
      expect(find.text('No hay conexión con el servidor.'), findsNothing);
      expect(compartidos, [archivoDePrueba]);
    });

    testWidgets('si el menú Compartir no abre, lo avisa', (tester) async {
      await iniciarApp(
        tester,
        crearContenedor(
          sesion: sesionDeEjemplo,
          compartir: (_) async => throw Exception('sin menú'),
        ),
        ruta: Rutas.misDatos,
      );

      await tocar(tester, find.text('Descargar mis datos'));

      expect(
        find.text('No se pudo abrir el menú para guardar el archivo.'),
        findsOne,
      );
    });
  });
}
