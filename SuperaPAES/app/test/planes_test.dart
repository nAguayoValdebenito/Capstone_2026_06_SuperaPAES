import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:supera_paes/datos/modelos/plan_modelo.dart';
import 'package:supera_paes/dominio/entidades/plan.dart';
import 'package:supera_paes/dominio/entidades/suscripcion_vigente.dart';
import 'package:supera_paes/nucleo/constantes.dart';
import 'package:supera_paes/nucleo/errores.dart';
import 'package:supera_paes/presentacion/comunes/componentes_seleccion.dart';

import 'apoyo/app_de_prueba.dart';
import 'apoyo/repositorio_cuentas_falso.dart';
import 'apoyo/repositorio_suscripciones_falso.dart';

Future<void> _abrir(
  WidgetTester tester,
  String ruta, {
  SuscripcionVigente? suscripcion,
  ErrorApi? error,
  AbrirEnlaceFalso? abrirEnlace,
}) async {
  await iniciarApp(
    tester,
    crearContenedor(
      sesion: sesionDeEjemplo,
      suscripciones: RepositorioSuscripcionesFalso(suscripcion: suscripcion)
        ..error = error,
      abrirEnlace: abrirEnlace,
    ),
    ruta: ruta,
  );
  // Alta: `iniciarApp` fija el tamaño y estas pantallas son largas.
  tester.view.physicalSize = const Size(800, 2400);
  await tester.pumpAndSettle();
}

typedef AbrirEnlaceFalso = Future<bool> Function(Uri enlace);

void main() {
  group('Planes en la API', () {
    test('lee el plan con su alcance, periodicidad y precio', () {
      final plan = PlanModelo.planes([
        {
          'id': 2,
          'nombre': 'Una prueba anual',
          'precioClp': 15990,
          'pruebasCubiertas': 1,
          'alcance': {'codigo': 'una_prueba', 'nombre': 'Una prueba'},
          'periodicidad': {'codigo': 'anual', 'nombre': 'Anual', 'meses': 12},
          'productos': {'google_play': 'una_prueba_anual'},
        },
      ]).single;

      expect(plan.id, 2);
      expect(plan.esAnual, isTrue);
      expect(plan.esUnaPrueba, isTrue);
      expect(plan.precio, r'$15.990');
    });

    test('el precio lleva puntos de miles', () {
      PlanOfrecido plan(int precio) => PlanOfrecido(
        id: 1,
        alcance: 'todas',
        alcanceNombre: 'Todas las pruebas',
        periodicidad: 'mensual',
        precioClp: precio,
      );

      expect(plan(990).precio, r'$990');
      expect(plan(2990).precio, r'$2.990');
      expect(plan(1234567).precio, r'$1.234.567');
    });
  });

  group('Planes (A43)', () {
    testWidgets(
      'sin plan parte en mensual, con los tres planes y sus precios',
      (tester) async {
        await _abrir(tester, Rutas.planes);

        expect(find.text('Gratis'), findsOne);
        expect(find.text('Una prueba'), findsOne);
        expect(find.text('Todas las pruebas'), findsOne);
        expect(find.text(r'$1.990'), findsOne);
        expect(find.text(r'$2.990'), findsOne);
        expect(find.text('al mes'), findsNWidgets(2));
        expect(find.text('Recomendado'), findsOne);
        expect(
          find.text('Pagas mes a mes y cancelas cuando quieras.'),
          findsOne,
        );
      },
    );

    testWidgets('al pasar a anual cambian los precios', (tester) async {
      await _abrir(tester, Rutas.planes);

      await tocar(tester, find.text('Anual'));

      expect(find.text(r'$15.990'), findsOne);
      expect(find.text(r'$23.990'), findsOne);
      expect(find.text(r'$1.990'), findsNothing);
      expect(
        find.text('El plan anual da 12 meses de acceso al precio de 8.'),
        findsOne,
      );
    });

    testWidgets('sin suscripción, el plan actual es Gratis', (tester) async {
      await _abrir(tester, Rutas.planes);

      expect(find.text('Tu plan'), findsOne);
      expect(find.text('Elegir Una prueba'), findsOne);
      expect(find.text('Elegir Todas las pruebas'), findsOne);
    });

    testWidgets('con un plan, el otro se ofrece como cambio (A45)', (
      tester,
    ) async {
      await _abrir(tester, Rutas.planes, suscripcion: suscripcionDeEjemplo);

      expect(find.text('Tu plan'), findsOne);
      expect(find.text('Gratis'), findsNothing);
      expect(find.text('Elegir Todas las pruebas'), findsNothing);

      await tocar(tester, find.text('Cambiar a Una prueba'));

      expect(find.text('Cambiar de plan'), findsOne);
      expect(find.text(r'$1.990 al mes'), findsOne);
    });

    testWidgets('elegir un plan avisa el modo de prueba, sin comprar', (
      tester,
    ) async {
      await _abrir(tester, Rutas.planes);

      await tocar(tester, find.text('Elegir Todas las pruebas'));

      expect(find.text('Modo de prueba'), findsOne);
      expect(
        find.textContaining('las compras no generan cobros reales'),
        findsWidgets,
      );
      expect(find.textContaining('Elegiste Todas las pruebas.'), findsOne);

      await tocar(tester, find.text('Entendido'));

      expect(find.text('Modo de prueba'), findsNothing);
    });

    testWidgets('Una prueba pregunta cuál incluye', (tester) async {
      await _abrir(tester, Rutas.planes);

      await tocar(tester, find.text('Elegir Una prueba'));

      expect(find.text('¿Qué prueba incluye tu plan?'), findsOne);

      await tocar(tester, find.textContaining('Elegir ').last);

      expect(find.text('Modo de prueba'), findsOne);
      expect(find.textContaining('Elegiste Una prueba ('), findsOne);
    });

    testWidgets('dice que el progreso es igual y cómo se renueva', (
      tester,
    ) async {
      await _abrir(tester, Rutas.planes);

      expect(
        find.text('Tu progreso es el mismo con cualquier plan.'),
        findsOne,
      );
      expect(
        find.textContaining('La suscripción se renueva automáticamente.'),
        findsOne,
      );
    });

    testWidgets('si no carga, permite reintentar', (tester) async {
      await _abrir(
        tester,
        Rutas.planes,
        error: const ErrorApi(codigo: 'SIN_CONEXION', mensaje: 'Sin conexión.'),
      );

      expect(find.text('Sin conexión.'), findsOne);
      expect(find.text('Reintentar'), findsOne);
    });

    testWidgets('con letra grande cabe en un teléfono chico', (tester) async {
      tester.platformDispatcher.textScaleFactorTestValue = 2;
      addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);

      await _abrir(tester, Rutas.planes);
      tester.view.physicalSize = const Size(360, 640);
      await tester.pumpAndSettle();

      expect(tester.takeException(), isNull);
    });
  });

  group('Mi suscripción (A44)', () {
    testWidgets('sin suscripción ofrece ver los planes', (tester) async {
      await _abrir(tester, Rutas.miSuscripcion);

      expect(find.text('Estás en el plan Gratis'), findsOne);
      expect(find.text('Ver planes'), findsOne);
      expect(find.text('Hoy en Gratis'), findsOne);
    });

    testWidgets('muestra el plan, el estado, la renovación y la tienda', (
      tester,
    ) async {
      await _abrir(
        tester,
        Rutas.miSuscripcion,
        suscripcion: suscripcionDeEjemplo,
      );

      expect(find.text('Todas las pruebas'), findsOne);
      expect(find.text('Activa'), findsOne);
      final etiqueta = tester.widget<Etiqueta>(find.byType(Etiqueta));
      expect(etiqueta.tono, TonoEtiqueta.exito);
      expect(find.text(r'Mensual · $2.990'), findsOne);
      expect(find.text('Próxima renovación'), findsOne);
      expect(find.text('20 de noviembre de 2026'), findsOne);
      expect(find.text('Google Play'), findsOne);
      expect(find.text('Modo de prueba: sin dinero real.'), findsOne);
      expect(find.text('Cambiar de plan'), findsOne);
    });

    testWidgets('Cambiar de plan muestra el de ahora y el nuevo (A45)', (
      tester,
    ) async {
      await _abrir(
        tester,
        Rutas.miSuscripcion,
        suscripcion: suscripcionDeEjemplo,
      );

      await tocar(tester, find.text('Cambiar de plan'));

      expect(find.text('Ahora'), findsOne);
      expect(find.text('Nuevo'), findsOne);
      expect(find.text(r'$2.990 al mes'), findsOne);
      expect(find.text(r'$1.990 al mes'), findsOne);
      expect(
        find.textContaining('Pasas a tener una sola prueba incluida.'),
        findsOne,
      );

      await tocar(tester, find.text('Confirmar el cambio'));

      expect(find.text('Modo de prueba'), findsOne);
    });

    testWidgets('cancelar abre la gestión de la tienda', (tester) async {
      final abiertos = <Uri>[];
      await _abrir(
        tester,
        Rutas.miSuscripcion,
        suscripcion: suscripcionDeEjemplo,
        abrirEnlace: (enlace) async {
          abiertos.add(enlace);
          return true;
        },
      );

      await tocar(tester, find.text('Cancelar suscripción en Google Play'));

      expect(abiertos.single.host, 'play.google.com');
      expect(abiertos.single.queryParameters['sku'], 'todas_mensual');
      expect(
        find.text(
          'Si cancelas, mantienes el plan hasta el 20 de noviembre de 2026.',
        ),
        findsOne,
      );
    });

    testWidgets('si la tienda no abre, lo dice', (tester) async {
      await _abrir(
        tester,
        Rutas.miSuscripcion,
        suscripcion: suscripcionDeEjemplo,
        abrirEnlace: (_) async => false,
      );

      await tocar(tester, find.text('Cancelar suscripción en Google Play'));

      expect(find.textContaining('No se pudo abrir Google Play'), findsOne);
    });

    testWidgets('en mora avisa que mantiene el acceso (A46)', (tester) async {
      await _abrir(
        tester,
        Rutas.miSuscripcion,
        suscripcion: const SuscripcionVigente(
          enMora: true,
          plan: 'Una prueba',
          periodicidad: 'anual',
          tienda: Tienda.appStore,
        ),
      );

      expect(find.text('En mora'), findsOne);
      expect(find.textContaining('No pudimos cobrar la renovación'), findsOne);
      expect(find.text('Revisar el pago en App Store'), findsOne);
      expect(find.text('Cambiar de plan'), findsNothing);
      expect(find.text('Cancelar suscripción en App Store'), findsOne);
    });

    testWidgets('si canceló, dice hasta cuándo y ya no ofrece cancelar', (
      tester,
    ) async {
      await _abrir(
        tester,
        Rutas.miSuscripcion,
        suscripcion: SuscripcionVigente(
          enMora: false,
          plan: 'Todas las pruebas',
          periodicidad: 'mensual',
          tienda: Tienda.googlePlay,
          periodoFin: DateTime(2026, 11, 20),
          renuevaAutomaticamente: false,
        ),
      );

      expect(find.text('Termina el'), findsOne);
      expect(find.text('Próxima renovación'), findsNothing);
      expect(find.text('Cancelar suscripción en Google Play'), findsNothing);
      expect(find.text('Ver en Google Play'), findsOne);
    });

    testWidgets('con letra grande cabe en un teléfono chico', (tester) async {
      tester.platformDispatcher.textScaleFactorTestValue = 2;
      addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);

      await _abrir(
        tester,
        Rutas.miSuscripcion,
        suscripcion: suscripcionDeEjemplo,
      );
      tester.view.physicalSize = const Size(360, 640);
      await tester.pumpAndSettle();

      expect(tester.takeException(), isNull);
    });
  });

  testWidgets('Perfil abre Mi suscripción', (tester) async {
    final contenedor = crearContenedor(sesion: sesionDeEjemplo);
    await iniciarApp(tester, contenedor, ruta: Rutas.perfil);

    await tocar(tester, find.text('Mi suscripción'));

    expect(rutaActual(contenedor), Rutas.miSuscripcion);
  });
}
