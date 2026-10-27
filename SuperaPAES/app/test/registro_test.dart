import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:supera_paes/datos/fuentes/fuente_cuentas_remota.dart';
import 'package:supera_paes/datos/modelos/documento_legal_modelo.dart';
import 'package:supera_paes/dominio/entidades/datos_registro.dart';
import 'package:supera_paes/nucleo/constantes.dart';
import 'package:supera_paes/nucleo/errores.dart';
import 'package:supera_paes/presentacion/comunes/estado_cuenta.dart';
import 'package:supera_paes/presentacion/comunes/texto_documento.dart';
import 'package:supera_paes/presentacion/crear_cuenta/validaciones_registro.dart';

import 'apoyo/app_de_prueba.dart';
import 'apoyo/repositorio_cuentas_falso.dart';

/// Responde siempre lo mismo y guarda la última petición.
class _AdaptadorFalso implements HttpClientAdapter {
  _AdaptadorFalso(this.estado, this.cuerpo);

  final int estado;
  final Map<String, dynamic> cuerpo;
  RequestOptions? ultimaPeticion;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    ultimaPeticion = options;
    return ResponseBody.fromString(
      jsonEncode(cuerpo),
      estado,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}

const _datos = DatosRegistro(
  nombre: 'Camila Rojas',
  correo: 'camila@ejemplo.cl',
  contrasena: 'una clave larga',
  documentosAceptados: [1, 2],
);

void main() {
  group('ValidacionesRegistro', () {
    test('el nombre es obligatorio y tiene hasta 100 caracteres', () {
      expect(ValidacionesRegistro.nombre('   '), 'Ingresa tu nombre.');
      expect(ValidacionesRegistro.nombre('a' * 101), isNotNull);
      expect(ValidacionesRegistro.nombre('  Camila   Rojas '), isNull);
      expect(
        ValidacionesRegistro.normalizarNombre('  Camila   Rojas '),
        'Camila Rojas',
      );
    });

    test('el correo debe ser válido', () {
      expect(ValidacionesRegistro.correo('camila'), isNotNull);
      expect(ValidacionesRegistro.correo(' camila@ejemplo.cl '), isNull);
    });

    test('la contraseña cumple el largo de RN-31 y no es igual al correo', () {
      const correo = 'camila@ejemplo.cl';
      expect(
        ValidacionesRegistro.contrasena('1234567', correo),
        'La contraseña debe tener al menos 8 caracteres.',
      );
      expect(ValidacionesRegistro.contrasena('a' * 73, correo), isNotNull);
      expect(
        ValidacionesRegistro.contrasena('Camila@Ejemplo.cl', correo),
        'La contraseña no puede ser igual al correo.',
      );
      expect(ValidacionesRegistro.contrasena('ñandú corre', correo), isNull);
      // Cuenta caracteres, no unidades UTF-16: 8 emojis bastan.
      expect(ValidacionesRegistro.contrasena('😀' * 8, correo), isNull);
    });

    test('el código de invitación es opcional y tiene el formato de RN-33', () {
      expect(ValidacionesRegistro.codigoInvitacion(''), isNull);
      expect(ValidacionesRegistro.codigoInvitacion('ab23cd'), isNull);
      expect(ValidacionesRegistro.codigoInvitacion('AB23C'), isNotNull);
      // Sin 0, O, 1 ni I.
      expect(ValidacionesRegistro.codigoInvitacion('AB01CD'), isNotNull);
    });
  });

  test('ErrorApi lee los problemas por campo de VALIDACION', () {
    final error = ErrorApi.desdeCuerpo({
      'data': null,
      'error': {
        'codigo': 'VALIDACION',
        'mensaje': 'Los datos enviados no son válidos.',
        'detalles': [
          {
            'lugar': 'cuerpo',
            'ruta': 'contrasena',
            'mensaje': 'Esa contraseña es muy común.',
            'motivo': 'contrasena_comun',
          },
          {'lugar': 'cuerpo', 'ruta': 'correo', 'mensaje': 'Correo malo.'},
        ],
      },
      'meta': null,
    }, estadoHttp: 400)!;

    expect(error.problemas, hasLength(2));
    expect(error.problemas.first.motivo, 'contrasena_comun');
    expect(error.problemas.last.motivo, isNull);
    expect(error.mensajeDeCampo('correo'), 'Correo malo.');
    expect(error.mensajeDeCampo('nombre'), isNull);
  });

  test('ErrorApi ignora detalles que no son una lista de problemas', () {
    final error = ErrorApi.desdeCuerpo({
      'error': {
        'codigo': 'CODIGO_INCORRECTO',
        'mensaje': 'El código no es correcto.',
        'detalles': {'intentosRestantes': 2},
      },
    })!;
    expect(error.problemas, isEmpty);
  });

  test('un documento de un tipo desconocido no se muestra', () {
    final modelo = DocumentoLegalModelo.fromJson({
      'id': 9,
      'tipo': 'otro',
      'nombre': 'Otro',
      'version': '1.0',
      'texto': '',
      'vigenteDesde': '2026-10-19T03:00:00.000Z',
    });
    expect(modelo.aEntidad(), isNull);
  });

  group('FuenteCuentasRemota', () {
    FuenteCuentasRemota fuenteCon(_AdaptadorFalso adaptador) =>
        FuenteCuentasRemota(Dio()..httpClientAdapter = adaptador);

    test(
      'envía el registro con la declaración de edad y lee la sesión',
      () async {
        final adaptador = _AdaptadorFalso(201, {
          'data': {
            'tokenAcceso': 'acceso',
            'tokenRenovacion': 'renovacion',
            'estudiante': {
              'id': 15,
              'nombre': 'Camila Rojas',
              'correo': 'camila@ejemplo.cl',
              'correoVerificado': false,
            },
          },
          'error': null,
          'meta': null,
        });

        final sesion = (await fuenteCon(
          adaptador,
        ).registrar(_datos)).aEntidad();

        expect(adaptador.ultimaPeticion?.path, '/cuentas/registro');
        expect(adaptador.ultimaPeticion?.data, {
          'nombre': 'Camila Rojas',
          'correo': 'camila@ejemplo.cl',
          'contrasena': 'una clave larga',
          'declaraTenerCatorceAnios': true,
          'documentosAceptados': [1, 2],
        });
        expect(sesion.tokenAcceso, 'acceso');
        expect(sesion.estudiante.id, 15);
        expect(sesion.estudiante.correoVerificado, isFalse);
      },
    );

    test('un 400 de la API llega como ErrorApi con sus problemas', () async {
      final adaptador = _AdaptadorFalso(400, {
        'data': null,
        'error': {
          'codigo': 'VALIDACION',
          'mensaje': 'Los datos enviados no son válidos.',
          'detalles': [
            {
              'lugar': 'cuerpo',
              'ruta': 'codigoInvitacion',
              'mensaje': 'No encontramos ese código de invitación.',
              'motivo': 'codigo_invitacion_inexistente',
            },
          ],
        },
        'meta': null,
      });

      await expectLater(
        fuenteCon(adaptador).registrar(_datos),
        throwsA(
          isA<ErrorApi>()
              .having((e) => e.estadoHttp, 'estadoHttp', 400)
              .having(
                (e) => e.mensajeDeCampo('codigoInvitacion'),
                'codigoInvitacion',
                'No encontramos ese código de invitación.',
              ),
        ),
      );
    });

    test('lee los documentos vigentes', () async {
      final adaptador = _AdaptadorFalso(200, {
        'data': [
          {
            'id': 1,
            'tipo': 'terminos',
            'nombre': 'Términos y condiciones',
            'version': '1.0',
            'texto': '# Términos',
            'vigenteDesde': '2026-10-19T03:00:00.000Z',
          },
        ],
        'error': null,
        'meta': null,
      });

      final documentos = await fuenteCon(adaptador).documentosVigentes();

      expect(
        adaptador.ultimaPeticion?.path,
        '/cuentas/documentos-legales/vigentes',
      );
      expect(documentos.single.id, 1);
      expect(documentos.single.aEntidad()?.version, '1.0');
    });
  });

  test('bloquesDeMarkdown separa títulos, listas y párrafos', () {
    final bloques = bloquesDeMarkdown(
      '# Título\n\nUna línea\nque sigue.\n\n## Sección\n\n- Uno\n- Dos\n',
    );
    expect(
      [for (final b in bloques) (b.tipo, b.texto)],
      [
        (TipoBloque.titulo, 'Título'),
        (TipoBloque.parrafo, 'Una línea que sigue.'),
        (TipoBloque.subtitulo, 'Sección'),
        (TipoBloque.elementoLista, 'Uno'),
        (TipoBloque.elementoLista, 'Dos'),
      ],
    );
  });

  group('Pantalla Crear cuenta (A01)', () {
    late RepositorioCuentasFalso repositorio;
    late AlmacenSesionEnMemoria almacen;
    late ProviderContainer contenedor;

    setUp(() {
      repositorio = RepositorioCuentasFalso();
      almacen = AlmacenSesionEnMemoria();
    });

    Future<void> abrir(WidgetTester tester) async {
      contenedor = crearContenedor(repositorio: repositorio, almacen: almacen);
      await iniciarApp(tester, contenedor, ruta: Rutas.crearCuenta);
    }

    Finder campo(String etiqueta) =>
        find.widgetWithText(TextFormField, etiqueta);

    Future<void> llenar(
      WidgetTester tester, {
      String contrasena = 'una clave larga',
      String codigo = '',
    }) async {
      await tester.enterText(campo('Nombre'), '  Camila   Rojas ');
      await tester.enterText(campo('Correo'), 'camila@ejemplo.cl');
      await tester.enterText(campo('Contraseña'), contrasena);
      await tester.enterText(campo('Código de invitación (opcional)'), codigo);
    }

    Future<void> aceptar(WidgetTester tester) =>
        tocar(tester, find.byType(CheckboxListTile));

    Future<void> crearCuenta(WidgetTester tester) =>
        tocar(tester, find.widgetWithText(FilledButton, 'Crear cuenta'));

    testWidgets('muestra los requisitos de la contraseña y los documentos', (
      tester,
    ) async {
      await abrir(tester);

      expect(find.text(ValidacionesRegistro.requisitosContrasena), findsOne);
      expect(
        find.text(
          'Acepto los Términos y condiciones (versión 1.0) y la Política de '
          'privacidad (versión 1.0), y declaro tener 14 años o más.',
        ),
        findsOne,
      );
    });

    testWidgets('sin datos ni aceptación no envía nada (CU-01 4.a)', (
      tester,
    ) async {
      await abrir(tester);
      await crearCuenta(tester);

      expect(find.text('Ingresa tu nombre.'), findsOne);
      expect(find.text('Ingresa un correo válido.'), findsOne);
      expect(
        find.text(
          'Debes aceptar los términos y la política de privacidad para crear '
          'tu cuenta.',
        ),
        findsOne,
      );
      expect(repositorio.registros, isEmpty);
    });

    testWidgets('la contraseña corta queda en error con su requisito (A01b)', (
      tester,
    ) async {
      await abrir(tester);
      await llenar(tester, contrasena: 'corta');
      await aceptar(tester);
      await crearCuenta(tester);

      expect(
        find.text('La contraseña debe tener al menos 8 caracteres.'),
        findsOne,
      );
      expect(repositorio.registros, isEmpty);
    });

    testWidgets('crea la cuenta, abre la sesión y pasa a Verificar correo', (
      tester,
    ) async {
      await abrir(tester);
      await llenar(tester, codigo: 'ab23cd');
      await aceptar(tester);
      await crearCuenta(tester);

      final enviado = repositorio.registros.single;
      expect(enviado.nombre, 'Camila Rojas');
      expect(enviado.correo, 'camila@ejemplo.cl');
      expect(enviado.documentosAceptados, [1, 2]);
      expect(enviado.codigoInvitacion, 'AB23CD');
      expect(contenedor.read(sesionProvider).value?.tokenAcceso, 'acceso');
      // La sesión del registro queda guardada en el teléfono.
      expect(almacen.guardada?.tokenRenovacion, 'renovacion');
      expect(find.widgetWithText(AppBar, 'Verificar correo'), findsOne);
    });

    testWidgets('sin código de invitación no lo envía', (tester) async {
      await abrir(tester);
      await llenar(tester);
      await aceptar(tester);
      await crearCuenta(tester);

      expect(repositorio.registros.single.codigoInvitacion, isNull);
    });

    testWidgets('muestra bajo el campo la contraseña común (RN-31)', (
      tester,
    ) async {
      repositorio.errorAlRegistrar = const ErrorApi(
        codigo: 'VALIDACION',
        mensaje: 'Los datos enviados no son válidos.',
        estadoHttp: 400,
        problemas: [
          ProblemaDeCampo(
            ruta: 'contrasena',
            mensaje:
                'Esa contraseña es muy común y fácil de adivinar. Elige otra.',
            motivo: 'contrasena_comun',
          ),
        ],
      );
      await abrir(tester);
      await llenar(tester, contrasena: 'password123');
      await aceptar(tester);
      await crearCuenta(tester);

      expect(
        find.text(
          'Esa contraseña es muy común y fácil de adivinar. Elige otra.',
        ),
        findsOne,
      );
      expect(find.widgetWithText(AppBar, 'Crear cuenta'), findsOne);
      expect(contenedor.read(sesionProvider).value, isNull);

      // Al corregir la contraseña, el error de la API desaparece.
      await tester.enterText(campo('Contraseña'), 'otra clave larga');
      await tester.pumpAndSettle();
      expect(
        find.text(
          'Esa contraseña es muy común y fácil de adivinar. Elige otra.',
        ),
        findsNothing,
      );
    });

    testWidgets('si el correo ya tiene cuenta lo indica bajo el correo (5.a)', (
      tester,
    ) async {
      const mensaje =
          'Ese correo ya tiene una cuenta. Inicia sesión o recupera tu '
          'contraseña.';
      repositorio.errorAlRegistrar = const ErrorApi(
        codigo: 'CONFLICTO',
        mensaje: mensaje,
        estadoHttp: 409,
      );
      await abrir(tester);
      await llenar(tester);
      await aceptar(tester);
      await crearCuenta(tester);

      final correo = tester.widget<TextField>(
        find.descendant(of: campo('Correo'), matching: find.byType(TextField)),
      );
      expect(correo.decoration?.errorText, mensaje);
    });

    testWidgets('sin conexión muestra el error general', (tester) async {
      repositorio.errorAlRegistrar = const ErrorApi(
        codigo: 'SIN_CONEXION',
        mensaje: 'No se pudo conectar con la API. Revisa tu conexión.',
      );
      await abrir(tester);
      await llenar(tester);
      await aceptar(tester);
      await crearCuenta(tester);

      expect(
        find.text('No se pudo conectar con la API. Revisa tu conexión.'),
        findsOne,
      );
    });

    testWidgets('el enlace de los términos abre su texto vigente (A02)', (
      tester,
    ) async {
      await abrir(tester);
      await tocar(tester, find.widgetWithText(TextButton, 'Leer los términos'));

      expect(find.widgetWithText(AppBar, 'Términos y condiciones'), findsOne);
      expect(find.text('Versión 1.0. Vigente desde 19/10/2026.'), findsOne);
      expect(find.text('1. Quiénes somos'), findsOne);
    });
  });
}
