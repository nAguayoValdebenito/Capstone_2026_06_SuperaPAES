import 'dart:async';
import 'dart:convert';

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
import 'package:supera_paes/presentacion/comunes/boton_principal.dart';
import 'package:supera_paes/presentacion/comunes/componentes.dart';
import 'package:supera_paes/presentacion/comunes/estado_cuenta.dart';
import 'package:supera_paes/presentacion/mis_datos/hoja_contrasena.dart';
import 'package:supera_paes/presentacion/mis_datos/pantalla_mis_datos.dart';

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

/// Escribe en el campo de la contraseña (de la hoja o de A42).
Future<void> _escribirContrasena(WidgetTester tester, String texto) async {
  await tester.enterText(
    find.descendant(
      of: find.byType(CampoContrasena),
      matching: find.byType(TextField),
    ),
    texto,
  );
  await tester.pump();
}

/// Toca «Descargar» en la hoja de la contraseña.
Future<void> _confirmarDescarga(WidgetTester tester) async {
  await tester.tap(find.widgetWithText(FilledButton, 'Descargar'));
  await tester.pumpAndSettle();
}

bool _sePuedeDescargar(WidgetTester tester) =>
    tester
        .widget<FilledButton>(find.widgetWithText(FilledButton, 'Descargar'))
        .onPressed !=
    null;

void main() {
  group('Archivo de mis datos', () {
    test('lleva el JSON del servidor con sangría y la fecha en el nombre', () {
      final archivo = MisDatosModelo.archivo(_misDatosJson);

      expect(archivo.nombre, 'supera-paes-mis-datos-2026-10-29.json');
      expect(archivo.contenido, contains('\n  "cuenta": {\n    "id": 84,'));
      expect(jsonDecode(archivo.contenido), _misDatosJson);
    });

    test('FuenteMisDatosRemota los pide con POST a /privacidad/mis-datos, '
        'con la contraseña en el cuerpo', () async {
      final adaptador = AdaptadorHttpFalso((_) => respuestaOk(_misDatosJson));

      final archivo = await FuenteMisDatosRemota(
        Dio()..httpClientAdapter = adaptador,
      ).descargar('clave-secreta');

      final peticion = adaptador.peticiones.single;
      expect(peticion.method, 'POST');
      expect(peticion.path, '/privacidad/mis-datos');
      expect(peticion.data, {'contrasena': 'clave-secreta'});
      expect(peticion.queryParameters, isEmpty);
      expect(peticion.extra[InterceptorSesion.confirmaContrasena], isTrue);
      expect(jsonDecode(archivo.contenido), _misDatosJson);
    });

    test('con la contraseña incorrecta, la fuente entrega el 401', () async {
      final fuente = FuenteMisDatosRemota(
        Dio()
          ..httpClientAdapter = AdaptadorHttpFalso(
            (_) => respuestaError(401, 'NO_AUTENTICADO', contrasenaIncorrecta),
          ),
      );

      await expectLater(
        fuente.descargar('otra'),
        throwsA(
          isA<ErrorApi>()
              .having((e) => e.estadoHttp, 'estado', 401)
              .having((e) => e.mensaje, 'mensaje', contrasenaIncorrecta),
        ),
      );
    });

    test('después de 5 intentos fallidos, la fuente entrega el 429', () async {
      final fuente = FuenteMisDatosRemota(
        Dio()
          ..httpClientAdapter = AdaptadorHttpFalso(
            (_) => respuestaError(
              429,
              'DEMASIADOS_INTENTOS',
              'Demasiados intentos. Espera unos minutos.',
            ),
          ),
      );

      await expectLater(
        fuente.descargar('otra'),
        throwsA(
          isA<ErrorApi>()
              .having((e) => e.estadoHttp, 'estado', 429)
              .having((e) => e.codigo, 'código', 'DEMASIADOS_INTENTOS'),
        ),
      );
    });
  });

  group('Errores de la contraseña', () {
    test('401 va bajo el campo; 429, sobre el botón; VALIDACION, bajo el '
        'campo; los demás, sobre el botón', () {
      expect(
        erroresDeContrasena(
          const ErrorApi(
            codigo: 'NO_AUTENTICADO',
            mensaje: contrasenaIncorrecta,
            estadoHttp: 401,
          ),
        ),
        (campo: contrasenaIncorrecta, general: null),
      );
      expect(
        erroresDeContrasena(
          const ErrorApi(
            codigo: 'DEMASIADOS_INTENTOS',
            mensaje: 'Demasiados intentos.',
            estadoHttp: 429,
          ),
        ),
        (campo: null, general: demasiadosIntentosContrasena),
      );
      expect(
        erroresDeContrasena(
          const ErrorApi(
            codigo: 'VALIDACION',
            mensaje: 'Revisa los datos.',
            estadoHttp: 400,
            problemas: [
              ProblemaDeCampo(
                ruta: 'contrasena',
                mensaje: 'La contraseña es demasiado larga.',
              ),
            ],
          ),
        ),
        (campo: 'La contraseña es demasiado larga.', general: null),
      );
      expect(
        erroresDeContrasena(
          const ErrorApi(codigo: 'SIN_CONEXION', mensaje: 'Sin conexión.'),
        ),
        (campo: null, general: 'Sin conexión.'),
      );
    });
  });

  group('Términos aceptados (A39, CU-14 paso 2)', () {
    test('con fechas distintas, cada documento lleva la suya', () {
      expect(
        terminosAceptados([
          DocumentoAceptado(
            tipo: TipoDocumentoLegal.terminos,
            version: '1.0',
            aceptadoEn: DateTime(2026, 10, 21),
          ),
          DocumentoAceptado(
            tipo: TipoDocumentoLegal.privacidad,
            version: '1.1',
            aceptadoEn: DateTime(2026, 10, 25),
          ),
        ]),
        'Aceptaste los Términos y condiciones 1.0 el 21 de octubre de 2026 '
        'y la Política de privacidad 1.1 el 25 de octubre de 2026.',
      );
    });

    test('con uno solo, lo nombra a él', () {
      expect(
        terminosAceptados([
          DocumentoAceptado(
            tipo: TipoDocumentoLegal.privacidad,
            version: '2.0',
            aceptadoEn: DateTime(2026, 3, 5),
          ),
        ]),
        'Aceptaste la Política de privacidad 2.0 el 5 de marzo de 2026.',
      );
    });

    testWidgets('si no se pudo consultar, A39 funciona igual sin la línea, '
        'que aparece al reintentar', (tester) async {
      final repo = RepositorioMisDatosFalso()
        ..errorEstado = const ErrorApi(
          codigo: 'SIN_CONEXION',
          mensaje: 'No hay conexión con el servidor.',
        );
      await iniciarApp(
        tester,
        crearContenedor(sesion: sesionDeEjemplo, misDatos: repo),
        ruta: Rutas.misDatos,
      );

      expect(find.textContaining('Aceptaste'), findsNothing);
      expect(find.text('Borrar mi cuenta'), findsOne);

      // Riverpod reintenta solo la consulta que falló.
      repo.errorEstado = null;
      await tester.pump(const Duration(seconds: 2));
      await tester.pumpAndSettle();
      expect(find.textContaining('Aceptaste'), findsOne);
    });
  });

  group('Mis datos y privacidad (A39)', () {
    testWidgets('Perfil abre A39 con la descarga y los puntajes', (
      tester,
    ) async {
      final contenedor = crearContenedor(sesion: sesionDeEjemplo);
      await iniciarApp(tester, contenedor, ruta: Rutas.perfil);

      await tocar(tester, find.text('Mis datos y privacidad'));

      expect(rutaActual(contenedor), Rutas.misDatos);
      expect(find.byType(BotonPrincipal), findsOne);
      expect(
        find.textContaining('Descargarás un archivo JSON con tu cuenta'),
        findsOne,
      );
      expect(find.text('Mis puntajes PAES'), findsOne);
      expect(find.text('Permiso desactivado'), findsOne);
      expect(find.text('Solicitudes sobre mis datos'), findsOne);
      // CU-14 paso 2: las versiones aceptadas, con su fecha.
      expect(
        find.text(
          'Aceptaste los Términos y condiciones 1.0 y la Política de '
          'privacidad 1.0 el 21 de octubre de 2026.',
        ),
        findsOne,
      );
      await tester.scrollUntilVisible(
        find.text('No se puede deshacer'),
        200,
        scrollable: find.byType(Scrollable).first,
      );
      expect(find.text('Borrar mi cuenta'), findsOne);
      await tester.scrollUntilVisible(
        find.byType(EnlaceVolver),
        -200,
        scrollable: find.byType(Scrollable).first,
      );
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

      await tocar(tester, find.byType(BotonPrincipal));
      // Primero pide la contraseña: sin ella no se puede confirmar.
      expect(find.byType(HojaContrasena<ArchivoMisDatos>), findsOne);
      expect(_sePuedeDescargar(tester), isFalse);
      expect(repo.descargas, 0);

      await _escribirContrasena(tester, 'clave-secreta');
      expect(_sePuedeDescargar(tester), isTrue);
      await tester.tap(find.widgetWithText(FilledButton, 'Descargar'));
      await tester.pump();
      await tester.pump();

      expect(repo.contrasenas, ['clave-secreta']);
      expect(compartidos, [archivoDePrueba]);
      // El botón gira mientras el menú sigue abierto: no se espera a que
      // se detenga, solo a que la hoja termine de cerrarse.
      await tester.pump(const Duration(seconds: 1));
      expect(find.byType(HojaContrasena<ArchivoMisDatos>), findsNothing);
      expect(
        tester.widget<BotonPrincipal>(find.byType(BotonPrincipal)).estado,
        EstadoBoton.cargando,
      );
      // Con el menú abierto, otro toque no la vuelve a pedir.
      await tester.tap(find.byType(BotonPrincipal));
      await tester.pump(const Duration(seconds: 1));
      expect(find.byType(HojaContrasena<ArchivoMisDatos>), findsNothing);
      expect(repo.descargas, 1);

      menu.complete();
      await tester.pumpAndSettle();
      expect(
        tester.widget<BotonPrincipal>(find.byType(BotonPrincipal)).estado,
        EstadoBoton.normal,
      );
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

      await tocar(tester, find.byType(BotonPrincipal));
      await _escribirContrasena(tester, 'clave-secreta');
      await _confirmarDescarga(tester);
      // El error queda en la hoja, que sigue abierta para reintentar.
      expect(find.text('No hay conexión con el servidor.'), findsOne);
      expect(compartidos, isEmpty);

      repo.error = null;
      await _confirmarDescarga(tester);
      expect(find.text('No hay conexión con el servidor.'), findsNothing);
      expect(find.byType(HojaContrasena<ArchivoMisDatos>), findsNothing);
      expect(compartidos, [archivoDePrueba]);
    });

    testWidgets('con la contraseña incorrecta (401), lo dice bajo el campo y '
        'la sesión sigue abierta', (tester) async {
      final repo = RepositorioMisDatosFalso()
        ..error = const ErrorApi(
          codigo: 'NO_AUTENTICADO',
          mensaje: contrasenaIncorrecta,
          estadoHttp: 401,
        );
      final compartidos = <ArchivoMisDatos>[];
      final contenedor = crearContenedor(
        sesion: sesionDeEjemplo,
        misDatos: repo,
        compartir: (archivo) async => compartidos.add(archivo),
      );
      await iniciarApp(tester, contenedor, ruta: Rutas.misDatos);

      await tocar(tester, find.byType(BotonPrincipal));
      await _escribirContrasena(tester, 'otra');
      await _confirmarDescarga(tester);

      expect(
        find.descendant(
          of: find.byType(CampoContrasena),
          matching: find.text(contrasenaIncorrecta),
        ),
        findsOne,
      );
      expect(compartidos, isEmpty);
      expect(contenedor.read(sesionProvider).value, isNotNull);
      expect(rutaActual(contenedor), Rutas.misDatos);

      // Al corregirla, el aviso del campo desaparece.
      await _escribirContrasena(tester, 'clave-secreta');
      expect(find.text(contrasenaIncorrecta), findsNothing);
    });

    testWidgets('después de 5 intentos fallidos (429), pide esperar unos '
        'minutos', (tester) async {
      final repo = RepositorioMisDatosFalso()
        ..error = const ErrorApi(
          codigo: 'DEMASIADOS_INTENTOS',
          mensaje: 'Demasiados intentos.',
          estadoHttp: 429,
        );
      await iniciarApp(
        tester,
        crearContenedor(sesion: sesionDeEjemplo, misDatos: repo),
        ruta: Rutas.misDatos,
      );

      await tocar(tester, find.byType(BotonPrincipal));
      await _escribirContrasena(tester, 'otra');
      await _confirmarDescarga(tester);

      expect(find.text(demasiadosIntentosContrasena), findsOne);
      expect(find.byType(HojaContrasena<ArchivoMisDatos>), findsOne);
    });

    testWidgets('«Cancelar» cierra la hoja sin descargar', (tester) async {
      final repo = RepositorioMisDatosFalso();
      await iniciarApp(
        tester,
        crearContenedor(sesion: sesionDeEjemplo, misDatos: repo),
        ruta: Rutas.misDatos,
      );

      await tocar(tester, find.byType(BotonPrincipal));
      await tester.tap(find.widgetWithText(TextButton, 'Cancelar'));
      await tester.pumpAndSettle();

      expect(find.byType(HojaContrasena<ArchivoMisDatos>), findsNothing);
      expect(repo.descargas, 0);
      expect(
        tester.widget<BotonPrincipal>(find.byType(BotonPrincipal)).estado,
        EstadoBoton.normal,
      );
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

      await tocar(tester, find.byType(BotonPrincipal));
      await _escribirContrasena(tester, 'clave-secreta');
      await _confirmarDescarga(tester);

      expect(
        find.text('No se pudo abrir el menú para guardar el archivo.'),
        findsOne,
      );
    });
  });
}
