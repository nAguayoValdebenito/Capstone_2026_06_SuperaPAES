import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:supera_paes/dominio/entidades/sesion_estudiante.dart';
import 'package:supera_paes/presentacion/aplicacion.dart';
import 'package:supera_paes/presentacion/comunes/componentes.dart';
import 'package:supera_paes/presentacion/comunes/estado_cuenta.dart';
import 'package:supera_paes/presentacion/enrutador.dart';
import 'package:supera_paes/presentacion/inicio/estado_inicio.dart';
import 'package:supera_paes/presentacion/perfil_estudio/estado_perfil.dart';

import 'repositorio_cuentas_falso.dart';
import 'repositorio_cupo_falso.dart';
import 'repositorio_perfil_falso.dart';

/// Contenedor de la app sin red ni almacén del teléfono. Con `sesion`, la
/// app arranca con esa sesión guardada.
ProviderContainer crearContenedor({
  RepositorioCuentasFalso? repositorio,
  RepositorioVerificacionFalso? verificacion,
  RepositorioPerfilFalso? perfil,
  RepositorioCupoFalso? cupo,
  AlmacenSesionEnMemoria? almacen,
  SesionEstudiante? sesion,
}) {
  final contenedor = ProviderContainer(
    overrides: [
      // Sin `cupo`, el del boceto A12.
      repositorioCupoProvider.overrideWithValue(cupo ?? RepositorioCupoFalso()),
      repositorioCuentasProvider.overrideWithValue(
        repositorio ?? RepositorioCuentasFalso(),
      ),
      almacenSesionProvider.overrideWithValue(
        almacen ?? AlmacenSesionEnMemoria(sesion),
      ),
      // Sin `perfil`, el estudiante ya completó su perfil (HU-29).
      repositorioPerfilProvider.overrideWithValue(
        perfil ?? RepositorioPerfilFalso(),
      ),
      // Sin `verificacion` queda el repositorio real, con el cliente con
      // sesión.
      if (verificacion != null)
        repositorioVerificacionProvider.overrideWithValue(verificacion),
    ],
  );
  addTearDown(contenedor.dispose);
  return contenedor;
}

/// Abre la app en el teléfono de referencia del diseño (390 × 844) y, si se
/// indica, navega a `ruta`.
Future<void> iniciarApp(
  WidgetTester tester,
  ProviderContainer contenedor, {
  String? ruta,
}) async {
  tester.view.physicalSize = const Size(390, 844);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(
    UncontrolledProviderScope(
      container: contenedor,
      child: const AplicacionSuperaPaes(),
    ),
  );
  await tester.pumpAndSettle();
  if (ruta != null) await ir(tester, contenedor, ruta);
}

Future<void> ir(
  WidgetTester tester,
  ProviderContainer contenedor,
  String ruta,
) async {
  contenedor.read(enrutadorProvider).go(ruta);
  await tester.pumpAndSettle();
}

/// Ruta de la pantalla visible. Las pantallas de los bocetos no tienen barra
/// superior, así que se reconocen por su ruta.
String rutaActual(ProviderContainer contenedor) =>
    contenedor.read(enrutadorProvider).state.matchedLocation;

/// El campo de texto que tiene esa etiqueta arriba (CampoTexto,
/// CampoContrasena o CampoCodigo).
Finder campo(String etiqueta) => find.descendant(
  of: find.widgetWithText(CampoConEtiqueta, etiqueta),
  matching: find.byType(TextField),
);

/// Desplaza la lista de la pantalla hasta el elemento y lo toca. La lista
/// construye sus hijos a medida que se desplaza, así que el elemento puede no
/// existir todavía.
Future<void> tocar(WidgetTester tester, Finder elemento) async {
  await tester.scrollUntilVisible(
    elemento,
    200,
    scrollable: find.byType(Scrollable).first,
  );
  await tester.pumpAndSettle();
  await tester.tap(elemento);
  await tester.pumpAndSettle();
}
