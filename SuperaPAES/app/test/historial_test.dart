import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:supera_paes/datos/modelos/historial_modelo.dart';
import 'package:supera_paes/dominio/entidades/historial.dart';
import 'package:supera_paes/nucleo/constantes.dart';
import 'package:supera_paes/nucleo/errores.dart';

import 'apoyo/app_de_prueba.dart';
import 'apoyo/repositorio_cuentas_falso.dart';
import 'apoyo/repositorio_resultados_falso.dart';

const _vacia = PaginaHistorial(
  evaluaciones: [],
  pagina: 1,
  porPagina: 20,
  total: 0,
);

/// Alta, para que la lista completa quede a la vista con su paginación. Va
/// después de abrir: `iniciarApp` fija el tamaño del teléfono.
Future<void> _pantallaAlta(WidgetTester tester) async {
  tester.view.physicalSize = const Size(800, 2400);
  await tester.pumpAndSettle();
}

Future<RepositorioResultadosFalso> _abrir(
  WidgetTester tester, {
  PaginaHistorial? pagina,
  ErrorApi? error,
}) async {
  final repo = RepositorioResultadosFalso()
    ..paginaHistorial = pagina ?? historialDeEjemplo
    ..errorHistorial = error;
  await iniciarApp(
    tester,
    crearContenedor(sesion: sesionDeEjemplo, resultados: repo),
    ruta: Rutas.historial,
  );
  return repo;
}

void main() {
  group('Historial en la API', () {
    test('lee cada fila y la paginación', () {
      final pagina = HistorialModelo.pagina(
        [
          {
            'id': 41,
            'tipo': {'codigo': 'practica', 'nombre': 'Práctica'},
            'prueba': {'id': 2, 'codigo': 'M1', 'nombre': 'Competencia M1'},
            'estado': {'codigo': 'abandonada', 'nombre': 'Abandonada'},
            'alcance': {'tipo': 'eje', 'id': 3, 'nombre': 'Números'},
            'dificultad': {'id': null, 'codigo': 'mezcla', 'nombre': 'Mezcla'},
            'cerradaEn': '2026-10-20T15:00:00.000Z',
            'cantidad': 5,
            'correctas': 3,
            'porcentaje': 60,
            'puntaje': null,
            'recalculadoEn': '2026-10-21T15:00:00.000Z',
          },
        ],
        {'pagina': 2, 'porPagina': 20, 'total': 41},
      );

      final fila = pagina.evaluaciones.single;
      expect(fila.prueba, 'Matemática M1');
      expect(fila.alcance, 'Números');
      expect(fila.abandonada, isTrue);
      expect(fila.recalculada, isTrue);
      expect(fila.porcentaje, 60);
      expect(pagina.paginas, 3);
    });

    test('toda la prueba no tiene alcance, y sin resultado no hay %', () {
      final pagina = HistorialModelo.pagina(
        [
          {
            'id': 42,
            'tipo': {'codigo': 'repaso', 'nombre': 'Repaso de errores'},
            'prueba': {'id': 1, 'codigo': 'CL', 'nombre': 'Lectora'},
            'estado': {'codigo': 'entregada', 'nombre': 'Entregada'},
            'alcance': {'tipo': 'prueba', 'id': 1, 'nombre': 'Lectora'},
            'dificultad': {'id': null, 'codigo': 'mezcla', 'nombre': 'Mezcla'},
            'cerradaEn': '2026-10-20T15:00:00.000Z',
            'cantidad': 5,
            'correctas': 0,
            'porcentaje': null,
            'puntaje': null,
            'recalculadoEn': null,
          },
        ],
        {'pagina': 1, 'porPagina': 20, 'total': 1},
      );

      final fila = pagina.evaluaciones.single;
      expect(fila.alcance, isNull);
      expect(fila.porcentaje, isNull);
      expect(fila.recalculada, isFalse);
    });

    test('una página vacía cuenta como una sola', () {
      expect(_vacia.paginas, 1);
    });
  });

  group('Historial (A34)', () {
    testWidgets('muestra cada evaluación con su detalle', (tester) async {
      await _abrir(tester);

      expect(find.text('Historial'), findsOne);
      expect(find.text('Mini-ensayo'), findsWidgets);
      expect(find.text('Matemática M1'), findsWidgets);
      expect(find.text('22 preguntas · 15 correctas · 68 %'), findsOne);
      expect(find.text('Matemática M2 · Logaritmos'), findsOne);
    });

    testWidgets('marca la abandonada y la recalculada', (tester) async {
      await _abrir(tester);

      expect(find.text('Abandonada: se guardó lo respondido'), findsOne);
      expect(
        find.text('Recalculado: se anuló una pregunta con error'),
        findsOne,
      );
    });

    testWidgets('el ensayo completo muestra su puntaje', (tester) async {
      await _abrir(
        tester,
        pagina: PaginaHistorial(
          evaluaciones: [
            EvaluacionDelHistorial(
              id: 9,
              tipoNombre: 'Ensayo completo',
              prueba: 'Matemática M1',
              cerradaEn: DateTime(2026, 10, 20),
              cantidad: 65,
              correctas: 40,
              porcentaje: 61,
              puntaje: 612,
            ),
          ],
          pagina: 1,
          porPagina: 20,
          total: 1,
        ),
      );

      expect(find.text('65 preguntas · 40 correctas · 612 puntos'), findsOne);
    });

    testWidgets('tocar una evaluación abre su resultado', (tester) async {
      final repo = await _abrir(tester);

      await tocar(tester, find.text('Matemática M2 · Logaritmos'));

      expect(repo.resultadosPedidos, [42]);
    });

    testWidgets('sin evaluaciones ofrece practicar (CU-30 2.a)', (
      tester,
    ) async {
      await _abrir(tester, pagina: _vacia);

      expect(find.text('Todavía no tienes evaluaciones'), findsOne);
      expect(find.text('Ir a practicar'), findsOne);
    });

    testWidgets('con filtros y sin resultados ofrece quitarlos', (
      tester,
    ) async {
      final repo = await _abrir(tester);
      repo.paginaHistorial = _vacia;

      await tocar(tester, find.text('Todos'));
      await tocar(tester, find.text('Repaso').last);

      expect(repo.consultas.last.tipo, 'repaso');
      expect(find.text('No hay evaluaciones con estos filtros'), findsOne);

      repo.paginaHistorial = historialDeEjemplo;
      await tocar(tester, find.text('Ver todas'));

      expect(repo.consultas.last.tipo, isNull);
      expect(find.text('Matemática M1'), findsWidgets);
    });

    testWidgets('pasa de página y vuelve', (tester) async {
      final repo = await _abrir(tester, pagina: historialConPaginas);
      await _pantallaAlta(tester);

      expect(find.text('Página 1 de 3'), findsOne);
      expect(find.text('Anterior'), findsNothing);

      await tocar(tester, find.text('Siguiente'));

      expect(repo.consultas.last.pagina, 2);
    });

    testWidgets('al cambiar un filtro vuelve a la primera página', (
      tester,
    ) async {
      final repo = await _abrir(tester, pagina: historialConPaginas);
      await _pantallaAlta(tester);

      await tocar(tester, find.text('Siguiente'));
      await tocar(tester, find.text('Todos'));
      await tocar(tester, find.text('Práctica').last);

      expect(repo.consultas.last.pagina, 1);
      expect(repo.consultas.last.tipo, 'practica');
    });

    testWidgets('si falla, permite reintentar', (tester) async {
      await _abrir(
        tester,
        error: const ErrorApi(codigo: 'SIN_CONEXION', mensaje: 'Sin conexión.'),
      );

      expect(find.text('Sin conexión.'), findsOne);
      expect(find.text('Reintentar'), findsOne);
    });

    testWidgets('con letra grande cabe en un teléfono chico', (tester) async {
      tester.platformDispatcher.textScaleFactorTestValue = 2;
      addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
      await _abrir(tester);

      tester.view.physicalSize = const Size(360, 640);
      await tester.pumpAndSettle();

      expect(tester.takeException(), isNull);
    });
  });

  group('Para llegar al historial', () {
    testWidgets('Progreso lo abre', (tester) async {
      final contenedor = crearContenedor(sesion: sesionDeEjemplo);
      await iniciarApp(tester, contenedor, ruta: Rutas.progreso);

      await tocar(tester, find.text('Historial'));

      expect(rutaActual(contenedor), Rutas.historial);
    });
  });
}
