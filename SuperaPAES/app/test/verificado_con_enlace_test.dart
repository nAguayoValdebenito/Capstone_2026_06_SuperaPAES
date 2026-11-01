import 'package:dio/dio.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:supera_paes/datos/fuentes/fuente_verificacion_remota.dart';
import 'package:supera_paes/nucleo/constantes.dart';
import 'package:supera_paes/nucleo/errores.dart';
import 'package:supera_paes/presentacion/comunes/estado_cuenta.dart';

import 'apoyo/adaptador_http_falso.dart';
import 'apoyo/app_de_prueba.dart';
import 'apoyo/repositorio_cuentas_falso.dart';

/// Quien verifica con el enlace del correo lo hace en la consola, fuera de la
/// app: la app lo nota con GET /cuentas/yo (DAS 4.3.3).
void main() {
  test('pregunta el estado de la cuenta con GET a /cuentas/yo', () async {
    final adaptador = AdaptadorHttpFalso(
      (_) => respuestaOk({
        'correoVerificado': true,
        'cupo': {'maximo': 20},
        'documentosAceptados': <Object>[],
      }),
    );

    final verificado = await FuenteVerificacionRemota(
      Dio()..httpClientAdapter = adaptador,
    ).correoVerificado();

    expect(adaptador.peticiones.single.method, 'GET');
    expect(adaptador.peticiones.single.path, '/cuentas/yo');
    expect(verificado, isTrue);
  });

  testWidgets('Inicio deja de pedir verificar el correo si se verificó con '
      'el enlace', (tester) async {
    final verificacion = RepositorioVerificacionFalso()
      ..verificadoConElEnlace = true;
    final almacen = AlmacenSesionEnMemoria(sesionDeEjemplo);
    final contenedor = crearContenedor(
      verificacion: verificacion,
      almacen: almacen,
    );

    await iniciarApp(tester, contenedor, ruta: Rutas.inicio);

    expect(verificacion.consultasEstado, greaterThan(0));
    expect(find.textContaining('Verifica tu correo'), findsNothing);
    expect(
      contenedor.read(sesionProvider).value?.estudiante.correoVerificado,
      isTrue,
    );
    // Queda guardado para la próxima vez que se abra la app.
    expect(almacen.guardada?.estudiante.correoVerificado, isTrue);
  });

  testWidgets('sin conexión, Inicio sigue pidiendo verificarlo', (
    tester,
  ) async {
    final verificacion = RepositorioVerificacionFalso()
      ..errorEstado = const ErrorApi(
        codigo: 'SIN_CONEXION',
        mensaje: 'No hay conexión con el servidor.',
      );
    await iniciarApp(
      tester,
      crearContenedor(sesion: sesionDeEjemplo, verificacion: verificacion),
      ruta: Rutas.inicio,
    );

    expect(
      find.text('Verifica tu correo y sube tu cupo a 20 preguntas diarias.'),
      findsOne,
    );
  });

  testWidgets('Verificar correo (A06) lo nota al volver a la app desde el '
      'navegador', (tester) async {
    final verificacion = RepositorioVerificacionFalso();
    await iniciarApp(
      tester,
      crearContenedor(sesion: sesionDeEjemplo, verificacion: verificacion),
      ruta: Rutas.verificarCorreo,
    );
    expect(find.text('Verifica tu correo'), findsOne);

    // Abre el enlace en el navegador y vuelve.
    verificacion.verificadoConElEnlace = true;
    tester.binding
      ..handleAppLifecycleStateChanged(AppLifecycleState.inactive)
      ..handleAppLifecycleStateChanged(AppLifecycleState.hidden)
      ..handleAppLifecycleStateChanged(AppLifecycleState.paused)
      ..handleAppLifecycleStateChanged(AppLifecycleState.hidden)
      ..handleAppLifecycleStateChanged(AppLifecycleState.inactive)
      ..handleAppLifecycleStateChanged(AppLifecycleState.resumed);
    await tester.pumpAndSettle();

    expect(find.text('¡Listo! Tu correo está verificado.'), findsOne);
  });
}
