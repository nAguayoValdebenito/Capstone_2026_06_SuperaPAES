import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:supera_paes/datos/modelos/puntajes_modelo.dart';
import 'package:supera_paes/dominio/entidades/puntajes_paes.dart';
import 'package:supera_paes/nucleo/constantes.dart';
import 'package:supera_paes/nucleo/errores.dart';

import 'apoyo/app_de_prueba.dart';
import 'apoyo/repositorio_cuentas_falso.dart';
import 'apoyo/repositorio_puntajes_falso.dart';

/// Con el permiso dado y M1 de la admisión 2026 cargado.
const PuntajesPaes _conM1 = PuntajesPaes(
  permiso: PermisoPuntajes(
    documentoId: 3,
    version: '1.0',
    texto: textoPermisoDePrueba,
    otorgado: true,
  ),
  puntajes: [PuntajePaes(id: 7, pruebaId: 2, anioAdmision: 2026, puntaje: 701)],
);

Future<void> _abrir(WidgetTester tester, RepositorioPuntajesFalso repo) =>
    iniciarApp(
      tester,
      crearContenedor(sesion: sesionDeEjemplo, puntajes: repo),
      ruta: Rutas.puntajes,
    );

Future<void> _cargar(WidgetTester tester, String anio, String puntaje) async {
  await tester.enterText(campo('Año'), anio);
  await tester.enterText(campo('Puntaje (100 a 1.000)'), puntaje);
  await tocar(tester, find.text('Guardar puntaje'));
}

void main() {
  group('Mis puntajes PAES (A41)', () {
    testWidgets('sin el permiso no deja cargar puntajes (CP-26 paso 1)', (
      tester,
    ) async {
      await _abrir(tester, RepositorioPuntajesFalso());

      expect(find.text('Mis puntajes PAES'), findsOne);
      expect(find.text('Permiso para usar mis puntajes'), findsOne);
      expect(tester.widget<Switch>(find.byType(Switch)).value, isFalse);
      expect(
        find.text('Para cargar tus puntajes, primero activa el permiso.'),
        findsOne,
      );
      expect(find.text('Guardar puntaje'), findsNothing);
      expect(find.text('Aún no cargas puntajes.'), findsOne);
      expect(find.text('Los puntajes son declarados por ti.'), findsOne);
    });

    testWidgets('activar el permiso muestra su texto y lo da al aceptarlo', (
      tester,
    ) async {
      final repo = RepositorioPuntajesFalso();
      await _abrir(tester, repo);

      await tester.tap(find.byType(Switch));
      await tester.pumpAndSettle();
      expect(find.text('Versión 1.0'), findsOne);
      expect(find.textContaining('Autorizo a Supera PAES a guardar'), findsOne);

      await tester.tap(find.text('Dar el permiso'));
      await tester.pumpAndSettle();

      expect(repo.permisosDados, [3]);
      expect(tester.widget<Switch>(find.byType(Switch)).value, isTrue);
      expect(find.text('Guardar puntaje'), findsOne);
    });

    testWidgets('«Ahora no» deja el permiso sin dar', (tester) async {
      final repo = RepositorioPuntajesFalso();
      await _abrir(tester, repo);

      await tester.tap(find.byType(Switch));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Ahora no'));
      await tester.pumpAndSettle();

      expect(repo.permisosDados, isEmpty);
      expect(tester.widget<Switch>(find.byType(Switch)).value, isFalse);
    });

    testWidgets('con el permiso guarda el puntaje y lo muestra (CP-26 paso '
        '2)', (tester) async {
      await _abrir(
        tester,
        RepositorioPuntajesFalso(
          estado: PuntajesPaes(permiso: _conM1.permiso, puntajes: const []),
        ),
      );

      // La prueba a reforzar del perfil viene elegida.
      expect(find.text('Matemática M1'), findsOne);
      await _cargar(tester, '2026', '701');

      expect(find.text('Aún no cargas puntajes.'), findsNothing);
      expect(find.text('Matemática M1'), findsNWidgets(2));
      expect(find.text('Admisión 2026'), findsOne);
      expect(find.text('701'), findsOne);
    });

    for (final (caso, anio, puntaje, mensaje) in [
      (
        'un puntaje fuera de rango',
        '2026',
        '1200',
        'El puntaje va de 100 a 1.000.',
      ),
      ('un puntaje bajo 100', '2026', '99', 'El puntaje va de 100 a 1.000.'),
      (
        'una admisión anterior a la PAES',
        '2022',
        '650',
        'Ingresa un año de admisión desde 2023.',
      ),
    ]) {
      testWidgets('rechaza $caso sin enviarlo (CP-26 paso 3)', (tester) async {
        final repo = RepositorioPuntajesFalso(
          estado: PuntajesPaes(permiso: _conM1.permiso, puntajes: const []),
        );
        await _abrir(tester, repo);

        await _cargar(tester, anio, puntaje);

        expect(find.text(mensaje), findsOne);
        expect((await repo.obtener()).puntajes, isEmpty);
      });
    }

    testWidgets('retirar el permiso avisa y borra los puntajes (RN-16)', (
      tester,
    ) async {
      await _abrir(tester, RepositorioPuntajesFalso(estado: _conM1));
      expect(find.text('701'), findsOne);

      await tester.tap(find.byType(Switch));
      await tester.pumpAndSettle();
      expect(find.text('¿Retirar el permiso?'), findsOne);
      expect(
        find.text('Borraremos el puntaje que cargaste. No se puede deshacer.'),
        findsOne,
      );
      await tester.tap(find.text('Retirar el permiso'));
      await tester.pumpAndSettle();

      expect(find.text('701'), findsNothing);
      expect(find.text('Aún no cargas puntajes.'), findsOne);
      expect(find.text('Guardar puntaje'), findsNothing);
    });

    testWidgets('borra un puntaje cargado', (tester) async {
      await _abrir(tester, RepositorioPuntajesFalso(estado: _conM1));

      await tocar(
        tester,
        find.byTooltip('Borrar el puntaje de Matemática M1, Admisión 2026'),
      );

      expect(find.text('701'), findsNothing);
      expect(find.text('Aún no cargas puntajes.'), findsOne);
    });

    testWidgets('si no carga, muestra el error y deja reintentar', (
      tester,
    ) async {
      final repo = RepositorioPuntajesFalso()
        ..error = const ErrorApi(
          codigo: 'SIN_CONEXION',
          mensaje: 'No hay conexión con el servidor.',
        );
      await _abrir(tester, repo);
      expect(find.text('No hay conexión con el servidor.'), findsOne);

      repo.error = null;
      await tocar(tester, find.text('Reintentar'));

      expect(find.text('Permiso para usar mis puntajes'), findsOne);
    });
  });

  group('Puntajes desde otras pantallas', () {
    testWidgets('Mis datos resume el permiso y abre A41', (tester) async {
      final contenedor = crearContenedor(
        sesion: sesionDeEjemplo,
        puntajes: RepositorioPuntajesFalso(estado: _conM1),
      );
      await iniciarApp(tester, contenedor, ruta: Rutas.misDatos);

      expect(find.text('Permiso activo · 1 puntaje cargado'), findsOne);
      await tocar(tester, find.text('Puntajes PAES'));

      expect(rutaActual(contenedor), Rutas.puntajes);
      await tocar(tester, find.text('Mis datos'));
      expect(rutaActual(contenedor), Rutas.misDatos);
    });

    testWidgets('Progreso compara los ensayos con el puntaje real (HU-41 '
        'esc. 2)', (tester) async {
      await iniciarApp(
        tester,
        crearContenedor(
          sesion: sesionDeEjemplo,
          puntajes: RepositorioPuntajesFalso(estado: _conM1),
        ),
        ruta: Rutas.progreso,
      );

      await tester.scrollUntilVisible(
        find.text('Tu puntaje PAES real'),
        200,
        scrollable: find.byType(Scrollable).first,
      );
      expect(find.text('Admisión 2026'), findsOne);
      expect(find.text('701'), findsOne);
    });

    testWidgets('sin el puntaje real, «Cargar» abre A41', (tester) async {
      final contenedor = crearContenedor(sesion: sesionDeEjemplo);
      await iniciarApp(tester, contenedor, ruta: Rutas.progreso);

      await tester.scrollUntilVisible(
        find.text('Aún no lo cargas'),
        200,
        scrollable: find.byType(Scrollable).first,
      );
      await tocar(tester, find.text('Cargar'));

      expect(rutaActual(contenedor), Rutas.puntajes);
    });
  });

  test('PuntajesModelo lee el JSON del contrato (HU-41)', () {
    final puntajes = PuntajesModelo.puntajes({
      'permiso': {
        'documento': {'id': '3', 'version': '1.0', 'texto': 'Permiso'},
        'otorgado': true,
        'otorgadoEn': '2026-10-28T15:00:00.000Z',
      },
      'puntajes': [
        {
          'id': '12',
          'pruebaId': 2,
          'anioAdmision': 2026,
          'puntaje': 650,
          'creadoEn': '2026-10-28T15:01:00.000Z',
        },
      ],
    });

    expect(puntajes.permiso.documentoId, 3);
    expect(puntajes.permiso.otorgado, isTrue);
    expect(puntajes.dePrueba(2)?.puntaje, 650);
    expect(puntajes.dePrueba(2)?.id, 12);
    expect(puntajes.dePrueba(1), isNull);
  });
}
