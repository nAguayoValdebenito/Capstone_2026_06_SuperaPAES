import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:supera_paes/datos/fuentes/fuente_perfil_remota.dart';
import 'package:supera_paes/dominio/entidades/perfil_estudiante.dart';
import 'package:supera_paes/nucleo/constantes.dart';
import 'package:supera_paes/nucleo/errores.dart';
import 'package:supera_paes/presentacion/comunes/componentes_seleccion.dart';
import 'package:supera_paes/presentacion/perfil_estudio/estado_perfil.dart';

import 'apoyo/adaptador_http_falso.dart';
import 'apoyo/app_de_prueba.dart';
import 'apoyo/repositorio_cuentas_falso.dart';
import 'apoyo/repositorio_perfil_falso.dart';

/// Lo que la API responde en GET /cuentas/perfil (docs/contratos/HU-29.md).
const Map<String, Object?> _perfilJson = {
  'completo': true,
  'curso': {'codigo': '3M', 'nombre': '3° medio'},
  'anioEgreso': 2027,
  'pruebas': [1, 2, 5],
  'electivoId': 4,
  'pruebaReforzarId': null,
  'areasCarrera': [1],
  'debeConfirmarCurso': false,
};

/// Un perfil de 4° medio al empezar el año escolar (A11).
const PerfilEstudiante _perfilDeMarzo = PerfilEstudiante(
  completo: true,
  curso: Curso(codigo: '4M', nombre: '4° medio'),
  anioEgreso: 2027,
  pruebas: [1, 2, 5],
  electivoId: 4,
  pruebaReforzarId: 2,
  areasCarrera: [1],
  debeConfirmarCurso: true,
);

/// Si la tarjeta de la prueba está marcada en A10. La lista construye sus
/// hijos al desplazarse, así que primero la deja a la vista.
Future<bool> estaMarcada(WidgetTester tester, String nombre) async {
  final tarjeta = find.widgetWithText(TarjetaCasilla, nombre);
  await tester.scrollUntilVisible(
    tarjeta,
    200,
    scrollable: find.byType(Scrollable).first,
  );
  return tester.widget<TarjetaCasilla>(tarjeta).marcada;
}

void main() {
  group('Año escolar (HU-29.3, RN-24)', () {
    test('empieza el 1 de marzo; enero y febrero son del año anterior', () {
      expect(anioEscolar(DateTime(2027, 1, 15)), 2026);
      expect(anioEscolar(DateTime(2028, 2, 29, 23, 59)), 2027);
      expect(anioEscolar(DateTime(2027, 3)), 2027);
      expect(anioEscolar(DateTime(2027, 12, 31)), 2027);
    });

    test('años para egresar: de 3 en 1° medio a 0 en 4° medio', () {
      expect(['1M', '2M', '3M', '4M', 'EG'].map(aniosParaEgresar), [
        3,
        2,
        1,
        0,
        null,
      ]);
    });
  });

  group('FuentePerfilRemota', () {
    FuentePerfilRemota fuenteCon(AdaptadorHttpFalso adaptador) =>
        FuentePerfilRemota(Dio()..httpClientAdapter = adaptador);

    test('lee el perfil con su curso, sus pruebas y sus áreas', () async {
      final adaptador = AdaptadorHttpFalso((_) => respuestaOk(_perfilJson));

      final perfil = await fuenteCon(adaptador).obtener();

      expect(adaptador.peticiones.single.method, 'GET');
      expect(adaptador.peticiones.single.path, '/cuentas/perfil');
      expect(perfil.curso?.codigo, '3M');
      expect(perfil.pruebas, [1, 2, 5]);
      expect(perfil.electivoId, 4);
      expect(perfil.pruebaReforzarId, isNull);
      expect(perfil.areasCarrera, [1]);
    });

    test('guarda con PUT el curso y, solo si egresó, el año', () async {
      final adaptador = AdaptadorHttpFalso((_) => respuestaOk(_perfilJson));
      final fuente = fuenteCon(adaptador);

      await fuente.guardar(
        const DatosPerfil(curso: '3M', pruebas: [1, 2], areasCarrera: [6]),
      );
      await fuente.confirmarCurso('EG', 2025);

      final [guardar, confirmar] = adaptador.peticiones;
      expect(guardar.method, 'PUT');
      expect(guardar.data, {
        'curso': '3M',
        'pruebas': [1, 2],
        'electivoId': null,
        'pruebaReforzarId': null,
        'areasCarrera': [6],
      });
      expect(confirmar.path, '/cuentas/perfil/confirmar-curso');
      expect(confirmar.data, {'curso': 'EG', 'anioEgreso': 2025});
    });

    test('lee las opciones con los electivos y las sugerencias', () async {
      final adaptador = AdaptadorHttpFalso(
        (_) => respuestaOk({
          'cursos': [
            {'codigo': '3M', 'nombre': '3° medio'},
          ],
          'pruebas': [
            {
              'id': 5,
              'codigo': 'CIE',
              'nombre': 'Ciencias',
              'electivos': [
                {'id': 4, 'nombre': 'Biología'},
              ],
            },
          ],
          'areasCarrera': [
            {
              'id': 1,
              'codigo': 'salud',
              'nombre': 'Salud',
              'pruebasSugeridas': [1, 2, 5],
              'electivoSugeridoId': 4,
            },
          ],
        }),
      );

      final opciones = await fuenteCon(adaptador).opciones();

      expect(adaptador.peticiones.single.path, '/temario/opciones-perfil');
      expect(opciones.electivo(4), 'Biología');
      expect(opciones.area(1)?.pruebasSugeridas, [1, 2, 5]);
    });
  });

  group('Bienvenida y pasos del perfil (A08 a A10)', () {
    late RepositorioPerfilFalso repositorio;
    late ProviderContainer contenedor;

    Future<void> abrir(WidgetTester tester, {PerfilEstudiante? perfil}) async {
      repositorio = RepositorioPerfilFalso(perfil: perfil ?? perfilVacio);
      contenedor = crearContenedor(
        sesion: sesionDeEjemplo,
        perfil: repositorio,
      );
      await iniciarApp(tester, contenedor);
    }

    Finder chip(String texto) => find.widgetWithText(ChipSeleccion, texto);
    Finder prueba(String nombre) => find.widgetWithText(TarjetaCasilla, nombre);
    Future<bool> marcada(WidgetTester tester, String nombre) =>
        estaMarcada(tester, nombre);

    testWidgets('con el perfil sin completar, la app abre el paso 1 y no deja '
        'ir a Inicio (CU-05 paso 1)', (tester) async {
      await abrir(tester);

      expect(rutaActual(contenedor), Rutas.perfilCurso);
      expect(find.text('Paso 1 de 3'), findsOneWidget);
      expect(find.text('¿En qué curso estás?'), findsOneWidget);

      await ir(tester, contenedor, Rutas.inicio);
      expect(rutaActual(contenedor), Rutas.perfilCurso);
    });

    testWidgets('paso 1: el curso muestra el año en que egresará (esc. 1)', (
      tester,
    ) async {
      await abrir(tester);

      await tocar(tester, find.text('3° medio'));

      final egreso = anioEscolar(DateTime.now()) + 1;
      expect(find.textContaining('Egresas de 4° medio en $egreso'), findsOne);
    });

    testWidgets('paso 1: si ya egresó, pide el año y lo revisa (A08b)', (
      tester,
    ) async {
      await abrir(tester);
      await tocar(tester, find.text('Ya egresé'));

      await tocar(tester, find.text('Continuar'));
      expect(find.text('Indica el año en que egresaste.'), findsOne);
      expect(rutaActual(contenedor), Rutas.perfilCurso);

      await tester.enterText(campo('Año en que egresaste de 4° medio'), '2025');
      await tocar(tester, find.text('Continuar'));
      expect(rutaActual(contenedor), Rutas.perfilAreas);
    });

    testWidgets('la bienvenida completa guarda el perfil y lleva a Inicio '
        '(esc. 2 a 5)', (tester) async {
      await abrir(tester);
      await tocar(tester, find.text('3° medio'));
      await tocar(tester, find.text('Continuar'));

      await tocar(tester, chip('Salud'));
      await tocar(tester, chip('Ciencias naturales'));
      expect(find.text('2 de 3'), findsOne);
      await tocar(tester, find.text('Ver pruebas sugeridas'));

      // Sugeridas por Salud y Ciencias naturales, con Biología por Salud.
      expect(rutaActual(contenedor), Rutas.perfilPruebas);
      expect(await marcada(tester, 'Competencia Lectora'), isTrue);
      expect(await marcada(tester, 'Competencia Matemática 2'), isTrue);
      expect(await marcada(tester, 'Ciencias'), isTrue);
      expect(await marcada(tester, 'Historia y Ciencias Sociales'), isFalse);
      expect(find.text('Biología es la sugerida para Salud.'), findsOne);

      await tocar(tester, prueba('Competencia Matemática 2'));
      await tocar(tester, chip('M1'));
      await tocar(tester, find.text('Guardar y empezar'));

      final datos = repositorio.guardados.single;
      expect(datos.curso, '3M');
      expect(datos.pruebas, [1, 2, 5]);
      expect(datos.electivoId, 4);
      expect(datos.pruebaReforzarId, 2);
      expect(datos.areasCarrera, [1, 3]);
      expect(rutaActual(contenedor), Rutas.inicio);
    });

    testWidgets('una cuarta área no se marca y el aviso lo explica (A09b, '
        'esc. 6)', (tester) async {
      await abrir(tester);
      await tocar(tester, find.text('3° medio'));
      await tocar(tester, find.text('Continuar'));
      for (final area in [
        'Salud',
        'Ciencias naturales',
        'Derecho y ciencia política',
      ]) {
        await tocar(tester, chip(area));
      }

      await tocar(tester, chip('Educación'));

      expect(find.text('3 de 3'), findsOne);
      expect(
        tester.widget<ChipSeleccion>(chip('Educación')).seleccionado,
        isFalse,
      );
      expect(
        find.textContaining('Para elegir Educación, primero desmarca otra.'),
        findsOne,
      );
    });

    testWidgets('sin áreas, Ciencias exige el electivo y no guarda (CU-05 4.a '
        'y 6.a)', (tester) async {
      await abrir(tester);
      await tocar(tester, find.text('3° medio'));
      await tocar(tester, find.text('Continuar'));
      await tocar(tester, find.text('Omitir'));

      expect(find.text('Elige las pruebas que rendirás.'), findsOne);
      await tocar(tester, prueba('Ciencias'));
      await tocar(tester, find.text('Guardar y empezar'));

      expect(
        find.text('Elige tu electivo de Ciencias: Biología, Física o Química.'),
        findsOne,
      );
      expect(repositorio.guardados, isEmpty);
    });

    testWidgets('un rechazo de la API se muestra y no sale del paso', (
      tester,
    ) async {
      await abrir(tester);
      repositorio.errorAlGuardar = const ErrorApi(
        codigo: 'VALIDACION',
        mensaje: 'Los datos enviados no son válidos.',
        estadoHttp: 400,
        problemas: [
          ProblemaDeCampo(
            ruta: 'pruebas',
            mensaje: 'Alguna de las pruebas elegidas no existe.',
          ),
        ],
      );
      await tocar(tester, find.text('3° medio'));
      await tocar(tester, find.text('Continuar'));
      await tocar(tester, find.text('Omitir'));
      await tocar(tester, prueba('Competencia Lectora'));
      await tocar(tester, find.text('Guardar y empezar'));

      expect(find.text('Alguna de las pruebas elegidas no existe.'), findsOne);
      expect(rutaActual(contenedor), Rutas.perfilPruebas);
    });
  });

  group('Confirmar el curso en marzo (A11)', () {
    late RepositorioPerfilFalso repositorio;
    late ProviderContainer contenedor;

    Future<void> abrir(WidgetTester tester) async {
      repositorio = RepositorioPerfilFalso(perfil: _perfilDeMarzo);
      contenedor = crearContenedor(
        sesion: sesionDeEjemplo,
        perfil: repositorio,
      );
      await iniciarApp(tester, contenedor);
    }

    testWidgets('si marzo empieza con la app en segundo plano, A11 aparece al '
        'volver a ella', (tester) async {
      repositorio = RepositorioPerfilFalso();
      contenedor = crearContenedor(
        sesion: sesionDeEjemplo,
        perfil: repositorio,
      );
      await iniciarApp(tester, contenedor);
      expect(find.text('Corregir mi curso'), findsNothing);

      repositorio.perfil = _perfilDeMarzo;
      tester.binding
        ..handleAppLifecycleStateChanged(AppLifecycleState.inactive)
        ..handleAppLifecycleStateChanged(AppLifecycleState.hidden)
        ..handleAppLifecycleStateChanged(AppLifecycleState.paused)
        ..handleAppLifecycleStateChanged(AppLifecycleState.hidden)
        ..handleAppLifecycleStateChanged(AppLifecycleState.inactive)
        ..handleAppLifecycleStateChanged(AppLifecycleState.resumed);
      await tester.pumpAndSettle();

      expect(find.text('Sí, estoy en 4° medio'), findsOne);
    });

    testWidgets('Inicio pide confirmar el curso calculado (esc. 8)', (
      tester,
    ) async {
      await abrir(tester);

      expect(
        find.text('Comenzó el año escolar ${anioEscolar(DateTime.now())}'),
        findsOne,
      );
      await tester.tap(find.text('Sí, estoy en 4° medio'));
      await tester.pumpAndSettle();

      expect(repositorio.confirmaciones, [('4M', null)]);
      expect(find.text('Sí, estoy en 4° medio'), findsNothing);
      expect(rutaActual(contenedor), Rutas.inicio);
    });

    testWidgets('«Corregir mi curso» abre el paso 1 y guarda solo el curso', (
      tester,
    ) async {
      await abrir(tester);

      await tester.tap(find.text('Corregir mi curso'));
      await tester.pumpAndSettle();
      expect(rutaActual(contenedor), Rutas.perfilCurso);
      expect(find.text('Paso 1 de 3'), findsNothing);

      await tocar(tester, find.text('3° medio'));
      await tocar(tester, find.text('Guardar mi curso'));

      expect(repositorio.confirmaciones, [('3M', null)]);
      expect(rutaActual(contenedor), Rutas.inicio);
      expect(find.text('Corregir mi curso'), findsNothing);
    });
  });

  group('Perfil (A37)', () {
    testWidgets('muestra el perfil de estudio y «Editar» guarda los cambios '
        '(esc. 9)', (tester) async {
      final repositorio = RepositorioPerfilFalso();
      final contenedor = crearContenedor(
        sesion: sesionDeEjemplo,
        perfil: repositorio,
      );
      await iniciarApp(tester, contenedor, ruta: Rutas.perfil);

      expect(find.text('Camila Rojas'), findsOne);
      expect(find.text('Sin verificar'), findsOne);
      expect(find.text('3° medio (egreso 2027)'), findsOne);
      expect(find.text('Lectora, M1, Ciencias'), findsOne);
      expect(find.text('Biología'), findsOne);
      expect(find.text('Salud'), findsOne);

      await tocar(tester, find.text('Editar'));
      expect(rutaActual(contenedor), Rutas.perfilCurso);
      await tocar(tester, find.text('Continuar'));
      await tocar(tester, find.text('Ver pruebas sugeridas'));
      // Las áreas no cambiaron: se conservan las pruebas guardadas.
      expect(await estaMarcada(tester, 'Competencia Matemática 2'), isFalse);
      await tocar(
        tester,
        find.widgetWithText(TarjetaCasilla, 'Historia y Ciencias Sociales'),
      );
      await tocar(tester, find.text('Guardar cambios'));

      expect(repositorio.guardados.single.pruebas, [1, 2, 4, 5]);
      expect(rutaActual(contenedor), Rutas.perfil);
      expect(find.text('Lectora, M1, Historia, Ciencias'), findsOne);
    });
  });
}
