import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:supera_paes/datos/fuentes/fuente_cuentas_remota.dart';
import 'package:supera_paes/datos/repositorios/almacen_sesion_seguro.dart';
import 'package:supera_paes/dominio/entidades/sesion_estudiante.dart';
import 'package:supera_paes/nucleo/constantes.dart';
import 'package:supera_paes/nucleo/errores.dart';
import 'package:supera_paes/nucleo/interceptor_sesion.dart';
import 'package:supera_paes/presentacion/comunes/estado_cuenta.dart';
import 'package:supera_paes/presentacion/enrutador.dart';
import 'package:supera_paes/presentacion/ingreso/pantalla_ingreso.dart';

import 'apoyo/adaptador_http_falso.dart';
import 'apoyo/app_de_prueba.dart';
import 'apoyo/repositorio_cuentas_falso.dart';

const Map<String, dynamic> _noAutenticado = {
  'data': null,
  'error': {
    'codigo': 'NO_AUTENTICADO',
    'mensaje': 'La sesión no es válida o venció.',
  },
  'meta': null,
};

const _sinConexion = ErrorApi(
  codigo: 'SIN_CONEXION',
  mensaje: 'No se pudo conectar con la API. Revisa tu conexión.',
);

const _sesionVencida = ErrorApi(
  codigo: 'NO_AUTENTICADO',
  mensaje: 'La sesión venció o se cerró. Vuelve a iniciar sesión.',
  estadoHttp: 401,
);

void main() {
  group('FuenteCuentasRemota', () {
    FuenteCuentasRemota fuenteCon(AdaptadorHttpFalso adaptador) =>
        FuenteCuentasRemota(Dio()..httpClientAdapter = adaptador);

    test('ingresa con el dispositivo y lee la sesión', () async {
      final adaptador = AdaptadorHttpFalso(
        (_) => (
          200,
          {
            'data': {
              'tokenAcceso': 'acceso',
              'tokenRenovacion': 'renovacion',
              'estudiante': {
                'id': '3',
                'nombre': 'Camila Rojas',
                'correo': 'camila@ejemplo.cl',
                'correoVerificado': true,
              },
            },
            'error': null,
            'meta': null,
          },
        ),
      );

      final sesion = (await fuenteCon(adaptador).ingresar(
        correo: 'camila@ejemplo.cl',
        contrasena: 'una clave larga',
        dispositivo: 'Android',
      )).aEntidad();

      final peticion = adaptador.peticiones.single;
      expect(peticion.path, '/cuentas/ingreso');
      expect(peticion.data, {
        'correo': 'camila@ejemplo.cl',
        'contrasena': 'una clave larga',
        'dispositivo': 'Android',
      });
      expect(sesion.estudiante.correoVerificado, isTrue);
    });

    test('sin dispositivo no envía la clave', () async {
      final adaptador = AdaptadorHttpFalso(
        (_) => (
          200,
          {
            'data': {
              'tokenAcceso': 'a',
              'tokenRenovacion': 'r',
              'estudiante': {
                'id': '3',
                'nombre': 'C',
                'correo': 'c@ejemplo.cl',
                'correoVerificado': false,
              },
            },
          },
        ),
      );
      await fuenteCon(
        adaptador,
      ).ingresar(correo: 'c@ejemplo.cl', contrasena: 'una clave larga');

      expect((adaptador.peticiones.single.data as Map<String, dynamic>).keys, [
        'correo',
        'contrasena',
      ]);
    });

    test('las credenciales incorrectas llegan como ErrorApi 401', () async {
      final adaptador = AdaptadorHttpFalso(
        (_) => (
          401,
          {
            'data': null,
            'error': {
              'codigo': 'NO_AUTENTICADO',
              'mensaje': 'Correo o contraseña incorrectos.',
            },
            'meta': null,
          },
        ),
      );

      await expectLater(
        fuenteCon(
          adaptador,
        ).ingresar(correo: 'c@ejemplo.cl', contrasena: 'mala'),
        throwsA(
          isA<ErrorApi>()
              .having((e) => e.estadoHttp, 'estadoHttp', 401)
              .having(
                (e) => e.mensaje,
                'mensaje',
                'Correo o contraseña incorrectos.',
              ),
        ),
      );
    });

    test('renueva con el token de renovación y lee los dos nuevos', () async {
      final adaptador = AdaptadorHttpFalso(
        (_) => (
          200,
          {
            'data': {'tokenAcceso': 'nuevo', 'tokenRenovacion': 'otro'},
            'error': null,
            'meta': null,
          },
        ),
      );

      final tokens = await fuenteCon(adaptador).renovar('viejo');

      expect(adaptador.peticiones.single.path, '/cuentas/renovar');
      expect(adaptador.peticiones.single.data, {'tokenRenovacion': 'viejo'});
      expect(tokens, (tokenAcceso: 'nuevo', tokenRenovacion: 'otro'));
    });

    test('cierra con el token de renovación', () async {
      final adaptador = AdaptadorHttpFalso(
        (_) => (
          200,
          {
            'data': {'sesionCerrada': true},
            'error': null,
            'meta': null,
          },
        ),
      );

      await fuenteCon(adaptador).cerrar('renovacion');

      expect(adaptador.peticiones.single.path, '/cuentas/cerrar');
      expect(adaptador.peticiones.single.data, {
        'tokenRenovacion': 'renovacion',
      });
    });
  });

  group('AlmacenSesionSeguro', () {
    test('guarda, lee y borra la sesión', () async {
      FlutterSecureStorage.setMockInitialValues({});
      const almacen = AlmacenSesionSeguro();

      expect(await almacen.leer(), isNull);
      await almacen.guardar(sesionDeEjemplo);
      final leida = await almacen.leer();
      expect(leida?.tokenAcceso, 'acceso');
      expect(leida?.tokenRenovacion, 'renovacion');
      expect(leida?.estudiante.correo, 'camila@ejemplo.cl');

      await almacen.borrar();
      expect(await almacen.leer(), isNull);
    });

    test('descarta una sesión guardada que no se puede leer', () async {
      FlutterSecureStorage.setMockInitialValues({
        'sesion_estudiante': '{"tokenAcceso": 1}',
      });
      const almacen = AlmacenSesionSeguro();

      expect(await almacen.leer(), isNull);
      expect(
        await const FlutterSecureStorage().read(key: 'sesion_estudiante'),
        isNull,
      );
    });
  });

  group('EstadoSesion', () {
    late RepositorioCuentasFalso repositorio;
    late AlmacenSesionEnMemoria almacen;

    ProviderContainer contenedorCon(SesionEstudiante? guardada) {
      repositorio = RepositorioCuentasFalso();
      almacen = AlmacenSesionEnMemoria(guardada);
      return crearContenedor(repositorio: repositorio, almacen: almacen);
    }

    test('al abrir la app lee la sesión guardada', () async {
      final contenedor = contenedorCon(sesionDeEjemplo);
      expect(await contenedor.read(sesionProvider.future), isNotNull);
    });

    test('abrir guarda la sesión', () async {
      final contenedor = contenedorCon(null);
      await contenedor.read(sesionProvider.future);

      await contenedor.read(sesionProvider.notifier).abrir(sesionDeEjemplo);

      expect(contenedor.read(sesionProvider).value, same(sesionDeEjemplo));
      expect(almacen.guardada, same(sesionDeEjemplo));
    });

    test(
      'renovar cambia los tokens, conserva al estudiante y guarda',
      () async {
        final contenedor = contenedorCon(sesionDeEjemplo);
        await contenedor.read(sesionProvider.future);

        final renovada = await contenedor
            .read(sesionProvider.notifier)
            .renovar();

        expect(renovada, isTrue);
        expect(repositorio.renovaciones, ['renovacion']);
        final sesion = contenedor.read(sesionProvider).value!;
        expect(sesion.tokenAcceso, 'acceso-1');
        expect(sesion.tokenRenovacion, 'renovacion-1');
        expect(sesion.estudiante.nombre, 'Camila Rojas');
        expect(almacen.guardada?.tokenRenovacion, 'renovacion-1');
      },
    );

    test('si la API rechaza la renovación, cierra la sesión local', () async {
      final contenedor = contenedorCon(sesionDeEjemplo);
      await contenedor.read(sesionProvider.future);
      repositorio.errorAlRenovar = _sesionVencida;

      expect(await contenedor.read(sesionProvider.notifier).renovar(), isFalse);
      expect(contenedor.read(sesionProvider).value, isNull);
      expect(almacen.guardada, isNull);
    });

    test('sin conexión la renovación falla pero conserva la sesión', () async {
      final contenedor = contenedorCon(sesionDeEjemplo);
      await contenedor.read(sesionProvider.future);
      repositorio.errorAlRenovar = _sinConexion;

      expect(await contenedor.read(sesionProvider.notifier).renovar(), isFalse);
      expect(contenedor.read(sesionProvider).value, isNotNull);
      expect(almacen.guardada, isNotNull);
    });

    test('cerrar avisa a la API y borra la sesión', () async {
      final contenedor = contenedorCon(sesionDeEjemplo);
      await contenedor.read(sesionProvider.future);

      await contenedor.read(sesionProvider.notifier).cerrar();

      expect(repositorio.cierres, ['renovacion']);
      expect(contenedor.read(sesionProvider).value, isNull);
      expect(almacen.guardada, isNull);
    });

    test('sin conexión, cerrar borra igual la sesión del teléfono', () async {
      final contenedor = contenedorCon(sesionDeEjemplo);
      await contenedor.read(sesionProvider.future);
      repositorio.errorAlCerrar = _sinConexion;

      await contenedor.read(sesionProvider.notifier).cerrar();

      expect(contenedor.read(sesionProvider).value, isNull);
      expect(almacen.guardada, isNull);
    });
  });

  group('InterceptorSesion', () {
    late String? token;
    late int renovaciones;
    late bool renovacionFunciona;
    late AdaptadorHttpFalso adaptador;
    late Dio dio;

    setUp(() {
      token = 'viejo';
      renovaciones = 0;
      renovacionFunciona = true;
      // La API acepta solo el token «nuevo».
      adaptador = AdaptadorHttpFalso(
        (opciones) => opciones.headers['Authorization'] == 'Bearer nuevo'
            ? (
                200,
                {
                  'data': {'ok': true},
                  'error': null,
                  'meta': null,
                },
              )
            : (401, _noAutenticado),
      );
      final base = Dio()..httpClientAdapter = adaptador;
      dio = Dio()
        ..httpClientAdapter = adaptador
        ..interceptors.add(
          InterceptorSesion(
            tokenAcceso: () => token,
            renovar: () async {
              renovaciones++;
              // Da tiempo a que otras peticiones lleguen mientras renueva.
              await Future<void>.delayed(const Duration(milliseconds: 10));
              if (!renovacionFunciona) {
                token = null;
                return false;
              }
              token = 'nuevo';
              return true;
            },
            reintentar: base.fetch,
          ),
        );
    });

    test('agrega el token de acceso a la petición', () async {
      token = 'nuevo';
      await dio.get<Object?>('/protegida');

      expect(
        adaptador.peticiones.single.headers['Authorization'],
        'Bearer nuevo',
      );
      expect(renovaciones, 0);
    });

    test('ante un 401 renueva y repite la petición', () async {
      final respuesta = await dio.get<Object?>('/protegida');

      expect(respuesta.statusCode, 200);
      expect(renovaciones, 1);
      expect(adaptador.peticiones.map((p) => p.headers['Authorization']), [
        'Bearer viejo',
        'Bearer nuevo',
      ]);
    });

    test(
      'si varias peticiones vencen a la vez, renueva una sola vez',
      () async {
        final respuestas = await Future.wait([
          dio.get<Object?>('/una'),
          dio.get<Object?>('/otra'),
          dio.get<Object?>('/tercera'),
        ]);

        expect(respuestas.map((r) => r.statusCode), [200, 200, 200]);
        expect(renovaciones, 1);
      },
    );

    test('si la renovación falla, devuelve el 401', () async {
      renovacionFunciona = false;

      await expectLater(
        dio.get<Object?>('/protegida'),
        throwsA(
          isA<DioException>().having(
            (e) => e.response?.statusCode,
            'estado',
            401,
          ),
        ),
      );
      expect(renovaciones, 1);
    });

    test('sin sesión no agrega token ni intenta renovar', () async {
      token = null;

      await expectLater(
        dio.get<Object?>('/protegida'),
        throwsA(isA<DioException>()),
      );
      expect(adaptador.peticiones.single.headers['Authorization'], isNull);
      expect(renovaciones, 0);
    });
  });

  group('redirigirSegunSesion', () {
    const conSesion = AsyncData<SesionEstudiante?>(sesionDeEjemplo);
    const sinSesion = AsyncData<SesionEstudiante?>(null);
    const cargando = AsyncLoading<SesionEstudiante?>();

    test('mientras lee la sesión, espera en Cargando', () {
      expect(redirigirSegunSesion(cargando, Rutas.inicio), Rutas.cargando);
      expect(redirigirSegunSesion(cargando, Rutas.cargando), isNull);
    });

    test('al terminar de leer, sale de Cargando según la sesión', () {
      expect(redirigirSegunSesion(conSesion, Rutas.cargando), Rutas.inicio);
      expect(redirigirSegunSesion(sinSesion, Rutas.cargando), Rutas.ingreso);
    });

    test('sin sesión solo deja las pantallas públicas', () {
      for (final ruta in rutasPublicas) {
        expect(redirigirSegunSesion(sinSesion, ruta), isNull, reason: ruta);
      }
      expect(redirigirSegunSesion(sinSesion, Rutas.perfil), Rutas.ingreso);
      expect(
        redirigirSegunSesion(sinSesion, Rutas.verificarCorreo),
        Rutas.ingreso,
      );
    });

    test('con sesión, Iniciar sesión lleva a Inicio', () {
      expect(redirigirSegunSesion(conSesion, Rutas.ingreso), Rutas.inicio);
      expect(redirigirSegunSesion(conSesion, Rutas.perfil), isNull);
      // El registro abre la sesión antes de ir a Verificar correo.
      expect(redirigirSegunSesion(conSesion, Rutas.crearCuenta), isNull);
    });
  });

  group('Pantalla Iniciar sesión (A03)', () {
    late RepositorioCuentasFalso repositorio;
    late AlmacenSesionEnMemoria almacen;
    late ProviderContainer contenedor;

    Future<void> abrir(WidgetTester tester) async {
      repositorio = RepositorioCuentasFalso();
      almacen = AlmacenSesionEnMemoria();
      contenedor = crearContenedor(repositorio: repositorio, almacen: almacen);
      await iniciarApp(tester, contenedor);
    }

    Future<void> ingresar(
      WidgetTester tester, {
      String correo = 'camila@ejemplo.cl',
      String contrasena = 'una clave larga',
    }) async {
      await tester.enterText(campo('Correo'), correo);
      await tester.enterText(campo('Contraseña'), contrasena);
      await tocar(tester, find.widgetWithText(FilledButton, 'Entrar'));
    }

    testWidgets('muestra el logo y el formulario', (tester) async {
      await abrir(tester);

      expect(find.image(const AssetImage(PantallaIngreso.logo)), findsOne);
      expect(campo('Correo'), findsOne);
      expect(campo('Contraseña'), findsOne);
      expect(find.text('Entrar (provisional)'), findsNothing);
    });

    testWidgets('sin datos no envía nada', (tester) async {
      await abrir(tester);
      await tocar(tester, find.widgetWithText(FilledButton, 'Entrar'));

      expect(find.text('Ingresa un correo válido.'), findsOne);
      expect(find.text('Ingresa tu contraseña.'), findsOne);
      expect(repositorio.ingresos, isEmpty);
    });

    testWidgets('con credenciales correctas guarda la sesión y va a Inicio', (
      tester,
    ) async {
      await abrir(tester);
      await ingresar(tester, correo: '  camila@ejemplo.cl ');

      final ingreso = repositorio.ingresos.single;
      expect(ingreso.correo, 'camila@ejemplo.cl');
      expect(ingreso.contrasena, 'una clave larga');
      // Las pruebas corren como Android.
      expect(ingreso.dispositivo, 'Android');
      expect(almacen.guardada, same(sesionDeEjemplo));
      expect(rutaActual(contenedor), Rutas.inicio);
    });

    testWidgets('con credenciales incorrectas muestra el mensaje de la API', (
      tester,
    ) async {
      await abrir(tester);
      repositorio.errorAlIngresar = const ErrorApi(
        codigo: 'NO_AUTENTICADO',
        mensaje: 'Correo o contraseña incorrectos.',
        estadoHttp: 401,
      );
      await ingresar(tester);

      expect(find.text('Correo o contraseña incorrectos.'), findsOne);
      expect(rutaActual(contenedor), Rutas.ingreso);
      expect(almacen.guardada, isNull);

      // Al corregir un campo, el mensaje desaparece.
      await tester.enterText(campo('Contraseña'), 'otra clave');
      await tester.pumpAndSettle();
      expect(find.text('Correo o contraseña incorrectos.'), findsNothing);
    });

    testWidgets('con demasiados intentos muestra el aviso', (tester) async {
      await abrir(tester);
      repositorio.errorAlIngresar = const ErrorApi(
        codigo: 'DEMASIADOS_INTENTOS',
        mensaje:
            'Hiciste demasiados intentos. Espera unos minutos y vuelve a '
            'probar.',
        estadoHttp: 429,
      );
      await ingresar(tester);

      expect(
        find.text(
          'Hiciste demasiados intentos. Espera unos minutos y vuelve a '
          'probar.',
        ),
        findsOne,
      );
    });

    testWidgets('el enlace lleva a Crear cuenta', (tester) async {
      await abrir(tester);
      await tocar(tester, find.widgetWithText(TextButton, 'Crea una'));

      expect(rutaActual(contenedor), Rutas.crearCuenta);
    });
  });

  group('Sesión en la app', () {
    testWidgets('con una sesión guardada, la app abre en Inicio', (
      tester,
    ) async {
      final contenedor = crearContenedor(sesion: sesionDeEjemplo);
      await iniciarApp(tester, contenedor);

      expect(rutaActual(contenedor), Rutas.inicio);
    });

    testWidgets('sin sesión, una pantalla de la cuenta lleva a Iniciar '
        'sesión', (tester) async {
      final contenedor = crearContenedor();
      await iniciarApp(tester, contenedor, ruta: Rutas.perfil);

      expect(rutaActual(contenedor), Rutas.ingreso);
    });

    testWidgets('Perfil muestra la cuenta y cierra la sesión', (tester) async {
      final repositorio = RepositorioCuentasFalso();
      final almacen = AlmacenSesionEnMemoria(sesionDeEjemplo);
      final contenedor = crearContenedor(
        repositorio: repositorio,
        almacen: almacen,
      );
      await iniciarApp(tester, contenedor, ruta: Rutas.perfil);

      expect(find.text('Camila Rojas'), findsOne);
      expect(find.text('camila@ejemplo.cl'), findsOne);

      await tocar(tester, find.text('Cerrar sesión'));

      expect(repositorio.cierres, ['renovacion']);
      expect(almacen.guardada, isNull);
      expect(rutaActual(contenedor), Rutas.ingreso);
    });

    testWidgets('si la renovación es rechazada, vuelve a Iniciar sesión', (
      tester,
    ) async {
      final repositorio = RepositorioCuentasFalso()
        ..errorAlRenovar = _sesionVencida;
      final contenedor = crearContenedor(
        repositorio: repositorio,
        sesion: sesionDeEjemplo,
      );
      await iniciarApp(tester, contenedor, ruta: Rutas.perfil);

      await contenedor.read(sesionProvider.notifier).renovar();
      await tester.pumpAndSettle();

      expect(rutaActual(contenedor), Rutas.ingreso);
    });
  });
}
