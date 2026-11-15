import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:supera_paes/datos/fuentes/fuente_mis_datos_remota.dart';
import 'package:supera_paes/datos/modelos/solicitudes_modelo.dart';
import 'package:supera_paes/dominio/entidades/solicitud_datos.dart';
import 'package:supera_paes/nucleo/constantes.dart';
import 'package:supera_paes/nucleo/errores.dart';
import 'package:supera_paes/presentacion/mis_datos/pantalla_solicitudes_datos.dart';

import 'apoyo/adaptador_http_falso.dart';
import 'apoyo/app_de_prueba.dart';
import 'apoyo/repositorio_cuentas_falso.dart';
import 'apoyo/repositorio_mis_datos_falso.dart';

/// Una solicitud respondida, como la entrega GET /privacidad/solicitudes.
const Map<String, dynamic> _respondidaJson = {
  'id': '9',
  'tipo': {'codigo': 'acceso', 'nombre': 'Acceso'},
  'detalle': 'Quiero saber qué datos tienen.',
  'estado': {'codigo': 'respondida', 'nombre': 'Respondida'},
  'solicitadoEn': '2026-11-01T13:00:00.000Z',
  'venceEn': '2026-12-01T13:00:00.000Z',
  'respondidoEn': '2026-11-05T15:00:00.000Z',
  'respuesta': 'Te enviamos una copia a tu correo.',
};

void main() {
  group('Datos de las solicitudes (HU-09.1)', () {
    test('lee una solicitud respondida con su respuesta', () {
      final solicitud = SolicitudesModelo.solicitud(_respondidaJson);
      expect(solicitud.tipo, 'Acceso');
      expect(solicitud.estado, EstadoSolicitud.respondida);
      expect(solicitud.respuesta, 'Te enviamos una copia a tu correo.');
      expect(solicitud.respondidoEn, isNotNull);
    });

    test('una respuesta sin fecha límite no se acepta', () {
      expect(
        () => SolicitudesModelo.solicitud(
          {..._respondidaJson}..remove('venceEn'),
        ),
        throwsA(isA<ErrorApi>()),
      );
    });

    test('pide los tipos y las solicitudes y envía con POST', () async {
      final adaptador = AdaptadorHttpFalso(
        (opciones) => switch ((opciones.method, opciones.path)) {
          ('GET', '/privacidad/tipos-derecho') => respuestaOk([
            {
              'codigo': 'acceso',
              'nombre': 'Acceso',
              'descripcion': 'Recibir una copia.',
            },
          ]),
          ('GET', '/privacidad/solicitudes') => respuestaOk([_respondidaJson]),
          _ => respuestaOk(_respondidaJson, estado: 201),
        },
      );
      final fuente = FuenteMisDatosRemota(Dio()..httpClientAdapter = adaptador);

      expect((await fuente.tiposDerecho()).single.codigo, 'acceso');
      expect((await fuente.solicitudes()).single.id, '9');
      await fuente.crearSolicitud('acceso', null);

      final envio = adaptador.peticiones.last;
      expect(envio.method, 'POST');
      expect(envio.path, '/privacidad/solicitudes');
      expect(envio.data, {'tipo': 'acceso', 'detalle': null});
    });
  });

  group('A40 Solicitudes sobre mis datos', () {
    testWidgets('Mis datos abre A40 con los tipos y sin solicitudes', (
      tester,
    ) async {
      final contenedor = crearContenedor(sesion: sesionDeEjemplo);
      await iniciarApp(tester, contenedor, ruta: Rutas.misDatos);

      await tocar(tester, find.text('Solicitudes sobre mis datos'));

      expect(rutaActual(contenedor), Rutas.solicitudesDatos);
      expect(find.text('Acceso'), findsOneWidget);
      expect(find.text('Corregir datos inexactos o incompletos.'), findsOne);
      await tocar(tester, find.text('Aún no has enviado solicitudes.'));
      expect(find.text('Aún no has enviado solicitudes.'), findsOne);
    });

    testWidgets('confirma con la fecha límite solo después de guardarla y la '
        'agrega a la lista', (tester) async {
      final repo = RepositorioMisDatosFalso();
      await iniciarApp(
        tester,
        crearContenedor(sesion: sesionDeEjemplo, misDatos: repo),
        ruta: Rutas.solicitudesDatos,
      );
      expect(find.textContaining('Recibimos tu solicitud'), findsNothing);

      await tocar(tester, find.text('Rectificación'));
      await tester.enterText(
        campo('Detalle (opcional)'),
        '  Mi nombre está mal escrito.  ',
      );
      await tocar(tester, find.text('Enviar solicitud'));

      expect(repo.enviadas.single, (
        'rectificacion',
        'Mi nombre está mal escrito.',
      ));
      expect(
        find.text(
          'Recibimos tu solicitud. Te responderemos a más tardar el '
          '15 de diciembre de 2026.',
        ),
        findsOne,
      );
      await tocar(tester, find.byType(TarjetaSolicitud));
      expect(find.text('Pendiente'), findsOne);
      expect(find.text('Mi nombre está mal escrito.'), findsOne);
    });

    testWidgets('si la API rechaza el envío, no confirma y conserva lo '
        'escrito', (tester) async {
      final repo = RepositorioMisDatosFalso()
        ..errorSolicitud = const ErrorApi(
          codigo: 'SIN_CONEXION',
          mensaje: 'Sin conexión por ahora.',
        );
      await iniciarApp(
        tester,
        crearContenedor(sesion: sesionDeEjemplo, misDatos: repo),
        ruta: Rutas.solicitudesDatos,
      );

      await tocar(tester, find.text('Acceso'));
      await tester.enterText(campo('Detalle (opcional)'), 'Una copia.');
      await tocar(tester, find.text('Enviar solicitud'));

      expect(find.textContaining('Recibimos tu solicitud'), findsNothing);
      expect(find.text('Sin conexión por ahora.'), findsOne);
      expect(find.text('Una copia.'), findsOne);
      expect(repo.solicitudesGuardadas, isEmpty);
    });

    testWidgets('sin elegir un tipo no se puede enviar', (tester) async {
      final repo = RepositorioMisDatosFalso();
      await iniciarApp(
        tester,
        crearContenedor(sesion: sesionDeEjemplo, misDatos: repo),
        ruta: Rutas.solicitudesDatos,
      );
      await tocar(tester, find.text('Enviar solicitud'));
      expect(repo.enviadas, isEmpty);
    });
  });
}
