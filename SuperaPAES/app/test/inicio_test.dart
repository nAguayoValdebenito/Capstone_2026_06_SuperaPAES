import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:supera_paes/dominio/entidades/cupo_de_hoy.dart';
import 'package:supera_paes/dominio/entidades/perfil_estudiante.dart';
import 'package:supera_paes/dominio/entidades/sesion_estudiante.dart';
import 'package:supera_paes/nucleo/constantes.dart';
import 'package:supera_paes/nucleo/errores.dart';
import 'package:supera_paes/presentacion/inicio/pruebas_inicio.dart';
import 'package:supera_paes/presentacion/practicar/estado_practica.dart';

import 'apoyo/app_de_prueba.dart';
import 'apoyo/repositorio_cuentas_falso.dart';
import 'apoyo/repositorio_cupo_falso.dart';
import 'apoyo/repositorio_perfil_falso.dart';

/// La sesión de ejemplo con el correo ya verificado.
final _verificada = SesionEstudiante(
  tokenAcceso: sesionDeEjemplo.tokenAcceso,
  tokenRenovacion: sesionDeEjemplo.tokenRenovacion,
  estudiante: Estudiante(
    id: sesionDeEjemplo.estudiante.id,
    nombre: sesionDeEjemplo.estudiante.nombre,
    correo: sesionDeEjemplo.estudiante.correo,
    correoVerificado: true,
  ),
);

CupoDeHoy _cupo({int usadas = 7, int saldoExtra = 5, int racha = 5}) =>
    CupoDeHoy(
      maximo: 10,
      usadas: usadas,
      restantes: 10 - usadas,
      saldoExtra: saldoExtra,
      reiniciaEn: DateTime.utc(2026, 10, 29, 3),
      racha: racha,
    );

Future<void> _abrirInicio(
  WidgetTester tester, {
  RepositorioCupoFalso? cupo,
  SesionEstudiante? sesion,
}) => iniciarApp(
  tester,
  crearContenedor(sesion: sesion ?? sesionDeEjemplo, cupo: cupo),
  ruta: Rutas.inicio,
);

void main() {
  group('Inicio (A12)', () {
    testWidgets('saluda con el primer nombre y muestra la racha (esc. 2)', (
      tester,
    ) async {
      await _abrirInicio(tester);

      expect(find.text('Hola,'), findsOne);
      expect(find.text('Camila'), findsOne);
      expect(find.text('Racha: 5 días'), findsOne);
    });

    testWidgets('una racha de un día va en singular', (tester) async {
      await _abrirInicio(
        tester,
        cupo: RepositorioCupoFalso(cupo: _cupo(racha: 1)),
      );

      expect(find.text('Racha: 1 día'), findsOne);
    });

    testWidgets('muestra las disponibles, las usadas, el reinicio y las '
        'preguntas extra (esc. 1)', (tester) async {
      await _abrirInicio(tester);

      expect(find.text('Tus preguntas de hoy'), findsOne);
      expect(find.text('3'), findsOne);
      expect(find.text('disponibles · 7 de 10 usadas'), findsOne);
      expect(find.text('Se reinicia a las 00:00 (hora de Chile)'), findsOne);
      expect(find.text('Extra: 5'), findsOne);
    });

    testWidgets('sin preguntas extra no muestra la etiqueta', (tester) async {
      await _abrirInicio(
        tester,
        cupo: RepositorioCupoFalso(cupo: _cupo(usadas: 0, saldoExtra: 0)),
      );

      expect(find.text('disponibles · 0 de 10 usadas'), findsOne);
      expect(find.textContaining('Extra'), findsNothing);
    });

    testWidgets('si el cupo no carga, muestra el error y «Reintentar» lo '
        'vuelve a pedir', (tester) async {
      final cupo = RepositorioCupoFalso()
        ..error = const ErrorApi(
          codigo: 'SIN_CONEXION',
          mensaje: 'No hay conexión con el servidor.',
        );
      await _abrirInicio(tester, cupo: cupo);
      expect(find.text('No hay conexión con el servidor.'), findsOne);

      cupo.error = null;
      await tester.tap(find.text('Reintentar'));
      await tester.pumpAndSettle();

      expect(find.text('disponibles · 7 de 10 usadas'), findsOne);
      expect(find.text('Racha: 5 días'), findsOne);
    });

    testWidgets('con el correo sin verificar invita a verificarlo; '
        'verificado, no', (tester) async {
      await _abrirInicio(tester);
      expect(
        find.text('Verifica tu correo y sube tu cupo a 20 preguntas diarias.'),
        findsOne,
      );

      await _abrirInicio(tester, sesion: _verificada);
      expect(find.textContaining('Verifica tu correo'), findsNothing);
    });

    testWidgets('lista las pruebas con la prueba a reforzar primero y '
        '«Reforzar» abre su práctica (esc. 3)', (tester) async {
      final contenedor = crearContenedor(sesion: sesionDeEjemplo);
      await iniciarApp(tester, contenedor, ruta: Rutas.inicio);

      final titulos = tester
          .widgetList<Text>(
            find.descendant(
              of: find.byType(InkWell),
              matching: find.byType(Text),
            ),
          )
          .map((texto) => texto.data)
          .where(
            (texto) =>
                texto != null &&
                (texto.startsWith('Matemática') ||
                    texto.startsWith('Competencia') ||
                    texto.startsWith('Ciencias')),
          );
      expect(titulos, [
        'Matemática M1',
        'Competencia Lectora',
        'Ciencias · Biología',
      ]);
      expect(find.text('Tu prueba a reforzar'), findsOne);

      await tocar(tester, find.text('Reforzar'));

      expect(rutaActual(contenedor), Rutas.practicar);
      expect(contenedor.read(borradorPracticaProvider).pruebaId, 2);
    });

    testWidgets('tocar otra prueba también abre su práctica, aunque se toque '
        'dos veces', (tester) async {
      final contenedor = crearContenedor(sesion: sesionDeEjemplo);
      await iniciarApp(tester, contenedor, ruta: Rutas.inicio);

      await tocar(tester, find.text('Competencia Lectora'));
      expect(rutaActual(contenedor), Rutas.practicar);
      expect(contenedor.read(borradorPracticaProvider).pruebaId, 1);

      contenedor.read(borradorPracticaProvider.notifier).elegirPrueba(5);
      await ir(tester, contenedor, Rutas.inicio);
      await tocar(tester, find.text('Competencia Lectora'));
      expect(contenedor.read(borradorPracticaProvider).pruebaId, 1);
    });

    testWidgets('relee el cupo al volver a la app y al deslizar hacia abajo', (
      tester,
    ) async {
      final cupo = RepositorioCupoFalso();
      await _abrirInicio(tester, cupo: cupo);
      expect(cupo.consultas, 1);

      // Pasó la medianoche con la app en segundo plano.
      cupo.cupo = _cupo(usadas: 0);
      tester.binding
        ..handleAppLifecycleStateChanged(AppLifecycleState.inactive)
        ..handleAppLifecycleStateChanged(AppLifecycleState.hidden)
        ..handleAppLifecycleStateChanged(AppLifecycleState.paused)
        ..handleAppLifecycleStateChanged(AppLifecycleState.hidden)
        ..handleAppLifecycleStateChanged(AppLifecycleState.inactive)
        ..handleAppLifecycleStateChanged(AppLifecycleState.resumed);
      await tester.pumpAndSettle();
      expect(cupo.consultas, 2);
      expect(find.text('disponibles · 0 de 10 usadas'), findsOne);

      await tester.fling(find.text('Hola,'), const Offset(0, 400), 1000);
      await tester.pumpAndSettle();
      expect(cupo.consultas, 3);
    });
  });

  group('pruebasDeInicio', () {
    PerfilEstudiante perfil({int? reforzar, int? electivo}) => PerfilEstudiante(
      completo: true,
      curso: const Curso(codigo: '3M', nombre: '3° medio'),
      anioEgreso: 2027,
      pruebas: const [1, 3, 5],
      electivoId: electivo,
      pruebaReforzarId: reforzar,
      areasCarrera: const [],
      debeConfirmarCurso: false,
    );

    test('sin prueba a reforzar conserva el orden del perfil', () {
      expect(pruebasDeInicio(perfil(), opcionesDePrueba), [
        (id: 1, titulo: 'Competencia Lectora', reforzar: false),
        (id: 3, titulo: 'Matemática M2', reforzar: false),
        (id: 5, titulo: 'Ciencias', reforzar: false),
      ]);
    });

    test('la prueba a reforzar va primero y Ciencias lleva su electivo', () {
      expect(
        pruebasDeInicio(perfil(reforzar: 5, electivo: 6), opcionesDePrueba),
        [
          (id: 5, titulo: 'Ciencias · Química', reforzar: true),
          (id: 1, titulo: 'Competencia Lectora', reforzar: false),
          (id: 3, titulo: 'Matemática M2', reforzar: false),
        ],
      );
    });
  });
}
