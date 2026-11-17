import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:supera_paes/datos/modelos/mis_datos_modelo.dart';
import 'package:supera_paes/dominio/entidades/cupo_de_hoy.dart';
import 'package:supera_paes/dominio/entidades/documento_legal.dart';
import 'package:supera_paes/dominio/entidades/suscripcion_vigente.dart';
import 'package:supera_paes/nucleo/constantes.dart';
import 'package:supera_paes/nucleo/errores.dart';
import 'package:supera_paes/nucleo/espera_servidor.dart';
import 'package:supera_paes/presentacion/aplicacion.dart';
import 'package:supera_paes/presentacion/comunes/animados.dart';
import 'package:supera_paes/presentacion/comunes/estado_usuario.dart';
import 'package:supera_paes/presentacion/comunes/estados.dart';
import 'package:supera_paes/presentacion/comunes/sello_prueba.dart';
import 'package:supera_paes/presentacion/enrutador.dart';
import 'package:supera_paes/presentacion/inicio/aviso_cambio_menor.dart';
import 'package:supera_paes/presentacion/inicio/tarjeta_cupo.dart';
import 'package:supera_paes/presentacion/planes/estado_planes.dart';

import 'apoyo/app_de_prueba.dart';
import 'apoyo/repositorio_cuentas_falso.dart';
import 'apoyo/repositorio_cupo_falso.dart';
import 'apoyo/repositorio_perfil_falso.dart';
import 'apoyo/repositorio_practica_falso.dart';
import 'apoyo/repositorio_suscripciones_falso.dart';

CupoDeHoy _cupo({bool verificado = true, int bonos = 0, int? restantes}) =>
    CupoDeHoy(
      maximo: verificado ? 20 : 10,
      usadas: restantes == null
          ? (verificado ? 7 : 2)
          : (verificado ? 20 : 10) - restantes,
      restantes: restantes ?? (verificado ? 13 : 8),
      saldoExtra: bonos,
      reiniciaEn: DateTime.now().add(const Duration(hours: 5)),
      racha: 5,
    );

SuscripcionVigente _plan({
  bool todas = false,
  bool mora = false,
  bool vigente = true,
}) => SuscripcionVigente(
  enMora: mora,
  plan: todas ? 'Todas las pruebas' : 'Una prueba',
  periodicidad: 'mensual',
  tienda: Tienda.googlePlay,
  alcance: todas ? 'todas' : 'una_prueba',
  pruebasIncluidas: todas ? const [] : const [2],
  coberturaVigente: vigente,
);

final List<
  ({String nombre, bool verificado, int bonos, SuscripcionVigente? plan})
>
_estados = [
  (nombre: 'G1', verificado: false, bonos: 0, plan: null),
  (nombre: 'G2', verificado: true, bonos: 0, plan: null),
  (nombre: 'G3', verificado: true, bonos: 5, plan: null),
  (nombre: 'S1', verificado: true, bonos: 0, plan: _plan()),
  (nombre: 'S2', verificado: true, bonos: 0, plan: _plan(todas: true)),
  (
    nombre: 'S3',
    verificado: true,
    bonos: 0,
    plan: _plan(todas: true, mora: true),
  ),
];

class _CupoPendiente extends RepositorioCupoFalso {
  final respuesta = Completer<CupoDeHoy>();
  @override
  Future<CupoDeHoy> cupoDeHoy() => respuesta.future;
}

class _CuentaConCambioMenor extends RepositorioCuentasFalso {
  @override
  Future<List<DocumentoLegal>> documentosVigentes() async => [
    DocumentoLegal(
      id: 11,
      tipo: TipoDocumentoLegal.terminos,
      nombre: 'Términos y condiciones',
      version: '1.1',
      texto: 'Términos actualizados de prueba.',
      vigenteDesde: DateTime(2026, 11),
    ),
    documentosDeEjemplo.last,
  ];
}

void main() {
  for (final caso in _estados) {
    test(
      'modelo ${caso.nombre}: cupo y bonos por prueba, cobertura del servidor',
      () {
        final usuario = EstadoUsuario(
          cupo: _cupo(verificado: caso.verificado, bonos: caso.bonos),
          perfil: perfilCompleto,
          verificado: caso.verificado,
          suscripcion: caso.plan,
        );
        final cubreM1 = caso.plan != null;
        final cubreCL = caso.plan?.alcance == 'todas';
        expect(usuario.cubre(2), cubreM1);
        expect(usuario.cubre(1), cubreCL);
        expect(
          usuario.disponibles(2),
          cubreM1 ? isNull : equals(usuario.cupoRestante + caso.bonos),
        );
        expect(
          usuario.disponibles(1),
          cubreCL ? isNull : equals(usuario.cupoRestante + caso.bonos),
        );
        expect(usuario.enMora, caso.nombre == 'S3');
        expect(usuario.cantidadSugerida(2), caso.nombre == 'G1' ? 8 : 10);
        expect(
          usuario.maximoCantidad(2),
          cubreM1 ? 20 : usuario.cupoRestante + caso.bonos,
        );
      },
    );

    for (final reducido in [false, true]) {
      testWidgets('${caso.nombre}: Inicio y Practicar con letra 2,0; '
          'reducido=$reducido', (tester) async {
        tester.platformDispatcher.textScaleFactorTestValue = 2;
        tester.platformDispatcher.accessibilityFeaturesTestValue =
            FakeAccessibilityFeatures(disableAnimations: reducido);
        addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
        addTearDown(
          tester.platformDispatcher.clearAccessibilityFeaturesTestValue,
        );
        final sesion = caso.verificado
            ? sesionDeEjemplo.conCorreoVerificado()
            : sesionDeEjemplo;
        final contenedor = crearContenedor(
          sesion: sesion,
          cupo: RepositorioCupoFalso(
            cupo: _cupo(verificado: caso.verificado, bonos: caso.bonos),
          ),
          suscripciones: RepositorioSuscripcionesFalso(suscripcion: caso.plan),
        );
        await iniciarApp(tester, contenedor);
        await tester.scrollUntilVisible(
          find.byType(TarjetaCupo),
          200,
          scrollable: find.byType(Scrollable).first,
        );
        await tester.pumpAndSettle();
        final usuario = contenedor.read(estadoUsuarioProvider).requireValue!;
        if (usuario.todasIncluidas) {
          expect(find.text('Practicas sin límite'), findsOne);
          expect(
            find.descendant(
              of: find.byType(TarjetaCupo),
              matching: find.byType(ContadorAnimado),
            ),
            findsNothing,
          );
        } else {
          expect(
            tester.widget<ContadorAnimado>(find.byType(ContadorAnimado)).valor,
            usuario.cupoRestante,
          );
        }
        if (usuario.enMora) {
          await tester.scrollUntilVisible(
            find.textContaining('No pudimos cobrar'),
            200,
            scrollable: find.byType(Scrollable).first,
          );
          expect(find.textContaining('Mantienes tu plan'), findsOne);
        }
        expect(tester.takeException(), isNull);
        await tester.tap(find.byKey(const ValueKey('pestana-1')).hitTestable());
        await tester.pumpAndSettle();
        expect(rutaActual(contenedor), Rutas.practicar);
        await tester.scrollUntilVisible(
          find.byTooltip('Más preguntas'),
          200,
          scrollable: find.byType(Scrollable).first,
        );
        await tester.pumpAndSettle();
        expect(find.text('${usuario.cantidadSugerida(2)}'), findsOne);
        expect(
          find.text('Inicio'),
          findsOne,
        ); // Solo la pestaña, sin «‹ Inicio».
        await tester.scrollUntilVisible(
          find.widgetWithText(ChipPrueba, 'Lectora'),
          -200,
          scrollable: find.byType(Scrollable).first,
        );
        await tocar(tester, find.widgetWithText(ChipPrueba, 'Lectora'));
        await tester.scrollUntilVisible(
          find.byTooltip('Más preguntas'),
          200,
          scrollable: find.byType(Scrollable).first,
        );
        await tester.pumpAndSettle();
        expect(find.text('${usuario.cantidadSugerida(1)}'), findsOne);
        expect(tester.takeException(), isNull);
      });
    }
  }

  test('una activa sin cobertura efectiva no se toma como ilimitada', () {
    final usuario = EstadoUsuario(
      cupo: _cupo(restantes: 2),
      perfil: perfilCompleto,
      verificado: true,
      suscripcion: _plan(todas: true, vigente: false),
    );
    expect(usuario.cubre(2), isFalse);
    expect(usuario.disponibles(2), 2);
    expect(usuario.puedePracticar(2), isFalse);
  });

  testWidgets('cupo bajo: no manda una cantidad que el servidor rechazaría', (
    tester,
  ) async {
    final practica = RepositorioPracticaFalso();
    final contenedor = crearContenedor(
      sesion: sesionDeEjemplo,
      cupo: RepositorioCupoFalso(cupo: _cupo(restantes: 3)),
      practica: practica,
    );
    await iniciarApp(tester, contenedor, ruta: Rutas.practicar);
    await tocar(tester, find.text('Ver cómo seguir'));
    expect(practica.iniciadas, isEmpty);
    expect(rutaActual(contenedor), Rutas.cupoAgotado);
    expect(find.text('Repasar errores'), findsOne);
  });

  testWidgets('carga real y sin conexión usan esqueleto, sin cupos ficticios', (
    tester,
  ) async {
    final cupo = _CupoPendiente();
    final contenedor = crearContenedor(sesion: sesionDeEjemplo, cupo: cupo);
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: contenedor,
        child: const AplicacionSuperaPaes(),
      ),
    );
    await tester.pump();
    await tester.pump(const Duration(seconds: 2));
    await tester.pump(const Duration(milliseconds: 400));
    await tester.pump();
    expect(find.byType(GrupoEsqueleto), findsWidgets);
    expect(find.byType(ContadorAnimado), findsNothing);
    cupo.respuesta.complete(_cupo());
    await tester.pumpAndSettle();
    expect(
      contenedor.read(estadoUsuarioProvider).requireValue!.cupoRestante,
      13,
    );
    expect(tester.takeException(), isNull);
  });

  testWidgets('sin conexión: reintentar recupera las cifras', (tester) async {
    final cupo = RepositorioCupoFalso()
      ..error = const ErrorApi(
        codigo: 'SIN_CONEXION',
        mensaje: 'Sin conexión para cargar tu cupo.',
      );
    final contenedor = crearContenedor(sesion: sesionDeEjemplo, cupo: cupo);
    await iniciarApp(tester, contenedor);
    expect(find.byType(EstadoError), findsOne);
    expect(find.byType(GrupoEsqueleto), findsOne);
    expect(find.byType(ContadorAnimado), findsNothing);
    cupo.error = null;
    await tocar(tester, find.text('Reintentar'));
    expect(
      contenedor.read(estadoUsuarioProvider).requireValue!.cupoRestante,
      3,
    );
  });

  test('A07b solo corresponde a una versión menor posterior', () {
    expect(esCambioMenor('1.0', '1.1'), isTrue);
    expect(esCambioMenor('1.2', '1.1'), isFalse);
    expect(esCambioMenor('1.0', '2.0'), isFalse);
    expect(esCambioMenor('1.0', '1.0'), isFalse);
    expect(esCambioMenor('invalida', '1.1'), isFalse);
  });

  test('el mapeo usa la cobertura explícita y no el nombre del plan', () {
    final datos = <String, dynamic>{
      'estado': 'activa',
      'plan': 'Nombre cambiado',
      'alcance': 'una_prueba',
      'pruebasIncluidas': ['2'],
      'coberturaVigente': true,
      'periodicidad': 'mensual',
      'tienda': 'google_play',
    };
    final plan = MisDatosModelo.suscripcionDesde(datos);
    expect(plan.cubre(2), isTrue);
    expect(plan.cubre(1), isFalse);
    datos.remove('coberturaVigente');
    expect(MisDatosModelo.suscripcionDesde(datos).cubre(2), isFalse);
  });

  testWidgets(
    'la cantidad enviada coincide con la mostrada y con la pregunta',
    (tester) async {
      final practica = RepositorioPracticaFalso();
      final contenedor = crearContenedor(
        sesion: sesionDeEjemplo,
        practica: practica,
      );
      await iniciarApp(tester, contenedor, ruta: Rutas.practicar);
      await tester.scrollUntilVisible(
        find.byTooltip('Más preguntas'),
        200,
        scrollable: find.byType(Scrollable).first,
      );
      expect(find.text('8'), findsOne);
      expect(
        tester
            .widget<IconButton>(find.widgetWithIcon(IconButton, Icons.add))
            .onPressed,
        isNull,
      );
      await tocar(tester, find.text('Empezar práctica'));
      expect(practica.iniciadas.single.cantidad, 8);
      expect(rutaActual(contenedor), Rutas.pregunta);
      expect(find.text('Hoy te quedan 8'), findsOne);
    },
  );

  testWidgets(
    'actualizar la suscripción actualiza el modelo sin copiar cupos',
    (tester) async {
      final planes = RepositorioSuscripcionesFalso();
      final contenedor = crearContenedor(
        sesion: sesionDeEjemplo,
        cupo: RepositorioCupoFalso(cupo: _cupo(restantes: 0)),
        suscripciones: planes,
      );
      await iniciarApp(tester, contenedor, ruta: Rutas.practicar);
      expect(
        contenedor.read(estadoUsuarioProvider).requireValue!.disponibles(2),
        0,
      );
      planes.suscripcion = _plan(todas: true, mora: true);
      contenedor.invalidate(suscripcionActualProvider);
      await tester.pumpAndSettle();
      final usuario = contenedor.read(estadoUsuarioProvider).requireValue!;
      expect(usuario.disponibles(1), isNull);
      expect(usuario.disponibles(2), isNull);
      expect(usuario.enMora, isTrue);
      expect(find.text('Empezar práctica'), findsOne);
    },
  );

  testWidgets('A14 usa el acierto y la recomendación recibidos por habilidad', (
    tester,
  ) async {
    final contenedor = crearContenedor(sesion: sesionDeEjemplo);
    await iniciarApp(tester, contenedor, ruta: Rutas.practicar);
    await tocar(tester, find.widgetWithText(ChipPrueba, 'Lectora'));
    await tocar(tester, find.text('Una habilidad'));
    expect(find.text('50 % de acierto · Conviene reforzar'), findsOne);
    await tocar(tester, find.text('Interpretar'));
    expect(rutaActual(contenedor), Rutas.practicar);
  });

  testWidgets(
    'A07b informa y permite revisar sin aceptar en nombre del usuario',
    (tester) async {
      final cuentas = _CuentaConCambioMenor();
      final contenedor = crearContenedor(
        sesion: sesionDeEjemplo,
        repositorio: cuentas,
      );
      await iniciarApp(tester, contenedor);
      await tester.scrollUntilVisible(
        find.textContaining('con cambios menores.'),
        200,
        scrollable: find.byType(Scrollable).first,
      );
      expect(find.textContaining('versión 1.1 con cambios menores.'), findsOne);
      await tocar(tester, find.text('Ver cambios'));
      expect(rutaActual(contenedor), Rutas.terminos);
      contenedor.read(enrutadorProvider).pop();
      await tester.pumpAndSettle();
      await tocar(tester, find.text('Entendido'));
      expect(find.textContaining('con cambios menores.'), findsNothing);
      expect(cuentas.registros, isEmpty);
    },
  );

  testWidgets(
    'el aviso de servidor despertando conserva la pantalla de Inicio',
    (tester) async {
      final contenedor = crearContenedor(sesion: sesionDeEjemplo);
      await iniciarApp(tester, contenedor);
      final espera = contenedor.read(esperaServidorProvider.notifier)..empezo();
      await tester.pump(EsperaServidor.paciencia);
      await tester.pump();
      expect(find.textContaining('Estamos despertando el servidor.'), findsOne);
      expect(rutaActual(contenedor), Rutas.inicio);
      espera.termino();
      await tester.pumpAndSettle();
      expect(
        find.textContaining('Estamos despertando el servidor.'),
        findsNothing,
      );
    },
  );
}
