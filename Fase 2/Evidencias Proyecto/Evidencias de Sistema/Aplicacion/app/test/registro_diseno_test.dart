import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:supera_paes/dominio/entidades/datos_registro.dart';
import 'package:supera_paes/dominio/entidades/documento_legal.dart';
import 'package:supera_paes/dominio/entidades/sesion_estudiante.dart';
import 'package:supera_paes/nucleo/constantes.dart';
import 'package:supera_paes/nucleo/errores.dart';
import 'package:supera_paes/nucleo/tema.dart';
import 'package:supera_paes/presentacion/comunes/animados.dart';
import 'package:supera_paes/presentacion/comunes/boton_principal.dart';
import 'package:supera_paes/presentacion/comunes/logo_acceso.dart';
import 'package:supera_paes/presentacion/crear_cuenta/requisitos_contrasena.dart';
import 'package:supera_paes/presentacion/enrutador.dart';

import 'apoyo/app_de_prueba.dart';
import 'apoyo/repositorio_cuentas_falso.dart';

class _RegistroPendiente extends RepositorioCuentasFalso {
  final respuesta = Completer<SesionEstudiante>();

  @override
  Future<SesionEstudiante> registrar(DatosRegistro datos) {
    registros.add(datos);
    return respuesta.future;
  }
}

class _CuentasDocumentos extends RepositorioCuentasFalso {
  List<DocumentoLegal> documentos = documentosDeEjemplo;
  int lecturas = 0;

  @override
  Future<List<DocumentoLegal>> documentosVigentes() async {
    lecturas++;
    return documentos;
  }
}

DocumentoLegal _version(DocumentoLegal original, String version, int id) =>
    DocumentoLegal(
      id: id,
      tipo: original.tipo,
      nombre: original.nombre,
      version: version,
      texto: original.texto,
      vigenteDesde: original.vigenteDesde,
    );

String _requisito(WidgetTester tester, String clave) => tester
    .widget<Semantics>(find.byKey(ValueKey('requisito-$clave')))
    .properties
    .label!;

final Finder _casilla = find.byKey(const ValueKey('casilla-aceptacion'));

Border? _borde(WidgetTester tester) =>
    (tester.widget<DecoratedBox>(_casilla).decoration as BoxDecoration).border
        as Border?;

BotonPrincipal _boton(WidgetTester tester) =>
    tester.widget<BotonPrincipal>(find.byType(BotonPrincipal));

Widget _marcoRequisitos({
  String contrasena = '',
  String correo = 'prueba@ejemplo.test',
  bool aceptada = false,
  bool rechazada = false,
}) => MaterialApp(
  home: Scaffold(
    body: RequisitosContrasena(
      contrasena: contrasena,
      correo: correo,
      aceptadaPorServidor: aceptada,
      comunRechazada: rechazada,
    ),
  ),
);

Future<void> _llenar(WidgetTester tester) async {
  await tester.enterText(campo('Nombre'), 'Estudiante de prueba');
  await tester.enterText(campo('Correo'), 'prueba@ejemplo.test');
  await tester.enterText(campo('Contraseña'), 'dato de prueba');
}

Future<void> _pulsarCrear(WidgetTester tester) async {
  await tester.pumpAndSettle();
  await tester.ensureVisible(find.byType(BotonPrincipal));
  await tester.pumpAndSettle();
  expect(find.byType(BotonPrincipal).hitTestable(), findsOne);
  await tester.tap(find.byType(BotonPrincipal));
  await tester.pump();
}

void main() {
  testWidgets('requisitos: no anticipa la revisión de contraseñas comunes', (
    tester,
  ) async {
    await tester.pumpWidget(_marcoRequisitos(contrasena: 'dato de prueba'));
    expect(_requisito(tester, 'largo'), startsWith('Cumplido:'));
    expect(_requisito(tester, 'correo'), startsWith('Cumplido:'));
    expect(_requisito(tester, 'comun'), startsWith('Pendiente:'));
    expect(find.textContaining('Se revisa al crear la cuenta.'), findsOne);
    await tester.pumpWidget(
      _marcoRequisitos(contrasena: 'dato de prueba', rechazada: true),
    );
    expect(_requisito(tester, 'comun'), startsWith('No cumplido:'));
    await tester.pumpWidget(
      _marcoRequisitos(contrasena: 'dato de prueba', aceptada: true),
    );
    expect(_requisito(tester, 'comun'), startsWith('Cumplido:'));
  });

  testWidgets(
    'requisitos: cuenta caracteres Unicode y compara el correo normalizado',
    (tester) async {
      await tester.pumpWidget(_marcoRequisitos(contrasena: '😀' * 7));
      expect(_requisito(tester, 'largo'), startsWith('Pendiente:'));
      await tester.pumpWidget(_marcoRequisitos(contrasena: '😀' * 8));
      expect(_requisito(tester, 'largo'), startsWith('Cumplido:'));
      await tester.pumpWidget(
        _marcoRequisitos(contrasena: ' PRUEBA@EJEMPLO.TEST '),
      );
      expect(_requisito(tester, 'correo'), startsWith('Pendiente:'));
    },
  );

  testWidgets('A01 usa el logo y actualiza las marcas al editar ambos campos', (
    tester,
  ) async {
    final contenedor = crearContenedor();
    await iniciarApp(tester, contenedor, ruta: Rutas.crearCuenta);
    expect(find.byType(LogoAcceso), findsOne);
    await tester.enterText(campo('Correo'), 'prueba@ejemplo.test');
    await tester.enterText(campo('Contraseña'), 'prueba@ejemplo.test');
    await tester.pump();
    expect(_requisito(tester, 'correo'), startsWith('Pendiente:'));
    await tester.enterText(campo('Correo'), 'otra@ejemplo.test');
    await tester.pump();
    expect(_requisito(tester, 'correo'), startsWith('Cumplido:'));
    await tester.enterText(campo('Contraseña'), 'corta');
    await tester.pump();
    expect(_requisito(tester, 'largo'), startsWith('Pendiente:'));
  });

  testWidgets(
    'desmontar durante el éxito cancela la confirmación del registro',
    (tester) async {
      final cuentas = _RegistroPendiente();
      final almacen = AlmacenSesionEnMemoria();
      final contenedor = crearContenedor(
        repositorio: cuentas,
        almacen: almacen,
      );
      await iniciarApp(tester, contenedor, ruta: Rutas.crearCuenta);
      await _llenar(tester);
      await tocar(tester, find.byType(Checkbox));
      await _pulsarCrear(tester);
      cuentas.respuesta.complete(sesionDeEjemplo);
      await tester.pump();
      await tester.pump();
      expect(_boton(tester).estado, EstadoBoton.exito);
      await tester.pumpWidget(const SizedBox.shrink());
      await tester.pump(const Duration(seconds: 1));
      expect(almacen.guardada, isNull);
      expect(tester.takeException(), isNull);
    },
  );

  for (final reducida in [false, true]) {
    testWidgets('casilla obligatoria con borde y respuesta de movimiento; '
        'reducido=$reducida', (tester) async {
      tester.platformDispatcher.accessibilityFeaturesTestValue =
          FakeAccessibilityFeatures(disableAnimations: reducida);
      addTearDown(
        tester.platformDispatcher.clearAccessibilityFeaturesTestValue,
      );
      final cuentas = RepositorioCuentasFalso();
      final contenedor = crearContenedor(repositorio: cuentas);
      await iniciarApp(tester, contenedor, ruta: Rutas.crearCuenta);
      await _llenar(tester);
      expect(_borde(tester), isNull);
      await _pulsarCrear(tester);
      await tester.pump(const Duration(milliseconds: 100));
      expect(_borde(tester)?.top.color, TemaSuperaPaes.error);
      expect(_boton(tester).estado, EstadoBoton.error);
      expect(cuentas.registros, isEmpty);
      final animacion = find.ancestor(
        of: _casilla,
        matching: find.byType(TweenAnimationBuilder<double>),
      );
      expect(animacion, reducida ? findsNothing : findsOne);
      if (!reducida) {
        final transformacion = find
            .ancestor(of: _casilla, matching: find.byType(Transform))
            .first;
        expect(
          tester.widget<Transform>(transformacion).transform.storage[12],
          isNot(0),
        );
      }
      await tester.pumpAndSettle();
      await _pulsarCrear(tester);
      expect(
        tester
            .widget<Sacudida>(
              find
                  .ancestor(of: _casilla, matching: find.byType(Sacudida))
                  .first,
            )
            .veces,
        2,
      );
      await tester.pumpAndSettle();
      expect(
        tester.getSize(find.byType(Checkbox)).width,
        greaterThanOrEqualTo(TemaSuperaPaes.zonaTactil),
      );
      await tocar(tester, find.byType(Checkbox));
      expect(_borde(tester), isNull);
      expect(_boton(tester).estado, EstadoBoton.normal);
      expect(cuentas.registros, isEmpty);
    });
  }

  testWidgets('casilla muestra las versiones vigentes de ambos documentos', (
    tester,
  ) async {
    final cuentas = _CuentasDocumentos()
      ..documentos = [
        _version(documentosDeEjemplo[0], '2.0', 11),
        _version(documentosDeEjemplo[1], '1.1', 12),
      ];
    final contenedor = crearContenedor(repositorio: cuentas);
    await iniciarApp(tester, contenedor, ruta: Rutas.crearCuenta);
    expect(
      find.text(
        'Acepto los Términos y condiciones (versión 2.0) y la '
        'Política de privacidad (versión 1.1) y declaro tener 14 años o más.',
      ),
      findsOne,
    );
    await tester.ensureVisible(find.byType(Checkbox));
    await tester.pumpAndSettle();
    await tester.tapOnText(
      find.textRange.ofSubstring('Política de privacidad'),
    );
    await tester.pumpAndSettle();
    expect(rutaActual(contenedor), Rutas.privacidad);
    contenedor.read(enrutadorProvider).pop();
    await tester.pumpAndSettle();
    expect(tester.widget<Checkbox>(find.byType(Checkbox)).value, isFalse);
  });

  testWidgets(
    'al cambiar documentos exige aceptar de nuevo y envía los nuevos IDs',
    (tester) async {
      final cuentas = _CuentasDocumentos();
      final contenedor = crearContenedor(repositorio: cuentas);
      await iniciarApp(tester, contenedor, ruta: Rutas.crearCuenta);
      await _llenar(tester);
      await tocar(tester, find.byType(Checkbox));
      cuentas
        ..documentos = [
          _version(documentosDeEjemplo[0], '2.0', 11),
          _version(documentosDeEjemplo[1], '2.0', 12),
        ]
        ..errorAlRegistrar = const ErrorApi(
          codigo: 'VALIDACION',
          mensaje: 'Revisa los documentos vigentes.',
          problemas: [
            ProblemaDeCampo(
              ruta: 'documentosAceptados',
              mensaje: 'Los documentos cambiaron. Vuelve a aceptarlos.',
            ),
          ],
        );
      await _pulsarCrear(tester);
      await tester.pumpAndSettle();
      expect(cuentas.lecturas, 2);
      expect(tester.widget<Checkbox>(find.byType(Checkbox)).value, isFalse);
      expect(find.textContaining('(versión 2.0)'), findsOne);
      expect(_borde(tester)?.top.color, TemaSuperaPaes.error);
      await _pulsarCrear(tester);
      await tester.pumpAndSettle();
      expect(cuentas.registros, hasLength(1));
      cuentas.errorAlRegistrar = null;
      await tocar(tester, find.byType(Checkbox));
      await _pulsarCrear(tester);
      await tester.pumpAndSettle();
      expect(cuentas.registros.last.documentosAceptados, [11, 12]);
      expect(rutaActual(contenedor), Rutas.verificarCorreo);
    },
  );

  testWidgets('registro pendiente bloquea duplicados y solo la API '
      'confirma la marca común', (tester) async {
    final cuentas = _RegistroPendiente();
    final almacen = AlmacenSesionEnMemoria();
    final contenedor = crearContenedor(repositorio: cuentas, almacen: almacen);
    await iniciarApp(tester, contenedor, ruta: Rutas.crearCuenta);
    await _llenar(tester);
    await tocar(tester, find.byType(Checkbox));
    await _pulsarCrear(tester);
    expect(_boton(tester).estado, EstadoBoton.cargando);
    expect(_requisito(tester, 'comun'), startsWith('Pendiente:'));
    expect(tester.widget<Checkbox>(find.byType(Checkbox)).onChanged, isNull);
    await tester.tap(find.byType(BotonPrincipal));
    await tester.pump(const Duration(milliseconds: 250));
    expect(cuentas.registros, hasLength(1));
    cuentas.respuesta.complete(sesionDeEjemplo);
    await tester.pump();
    await tester.pump();
    expect(_boton(tester).estado, EstadoBoton.exito);
    expect(_requisito(tester, 'comun'), startsWith('Cumplido:'));
    expect(almacen.guardada, isNull);
    await tester.pumpAndSettle();
    expect(almacen.guardada, same(sesionDeEjemplo));
    expect(rutaActual(contenedor), Rutas.verificarCorreo);
  });

  testWidgets(
    'rechazo de contraseña común se muestra y vuelve a pendiente al corregirla',
    (tester) async {
      final cuentas = RepositorioCuentasFalso()
        ..errorAlRegistrar = const ErrorApi(
          codigo: 'VALIDACION',
          mensaje: 'Revisa tu contraseña.',
          problemas: [
            ProblemaDeCampo(
              ruta: 'contrasena',
              motivo: 'contrasena_comun',
              mensaje: 'Elige una contraseña menos común.',
            ),
          ],
        );
      final contenedor = crearContenedor(repositorio: cuentas);
      await iniciarApp(tester, contenedor, ruta: Rutas.crearCuenta);
      await _llenar(tester);
      await tocar(tester, find.byType(Checkbox));
      await _pulsarCrear(tester);
      await tester.pumpAndSettle();
      expect(_requisito(tester, 'comun'), startsWith('No cumplido:'));
      expect(_boton(tester).estado, EstadoBoton.error);
      expect(find.text('Elige una contraseña menos común.'), findsOne);
      await tester.enterText(campo('Contraseña'), 'otro dato de prueba');
      await tester.pumpAndSettle();
      expect(_requisito(tester, 'comun'), startsWith('Pendiente:'));
      expect(_boton(tester).estado, EstadoBoton.normal);
    },
  );

  for (final reducida in [false, true]) {
    testWidgets(
      'registro y error de casilla con letra 2,0; reducido=$reducida',
      (tester) async {
        tester.platformDispatcher.textScaleFactorTestValue = 2;
        tester.platformDispatcher.accessibilityFeaturesTestValue =
            FakeAccessibilityFeatures(disableAnimations: reducida);
        addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
        addTearDown(
          tester.platformDispatcher.clearAccessibilityFeaturesTestValue,
        );
        final cuentas = RepositorioCuentasFalso();
        final contenedor = crearContenedor(repositorio: cuentas);
        await iniciarApp(tester, contenedor, ruta: Rutas.crearCuenta);
        await _llenar(tester);
        await _pulsarCrear(tester);
        await tester.pumpAndSettle();
        expect(_borde(tester)?.top.color, TemaSuperaPaes.error);
        expect(cuentas.registros, isEmpty);
        expect(tester.takeException(), isNull);
        await tocar(tester, find.byType(Checkbox));
        await _pulsarCrear(tester);
        await tester.pumpAndSettle();
        expect(rutaActual(contenedor), Rutas.verificarCorreo);
      },
    );
  }
}
