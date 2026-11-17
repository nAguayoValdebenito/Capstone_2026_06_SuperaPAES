import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:supera_paes/presentacion/comunes/secciones.dart';

import 'apoyo/app_de_prueba.dart';
import 'apoyo/repositorio_cuentas_falso.dart';

/// Tamaños en que se recorre la app (plan de mejora visual, tanda A): el
/// teléfono más chico que se apoya y una tablet en vertical.
const Map<String, Size> _tamanos = {
  'teléfono de 360 × 640': Size(360, 640),
  'tablet de 768 × 1024': Size(768, 1024),
};

/// Letra normal y la letra al doble del sistema.
const List<double> _escalas = [1, 2];

/// Recorre todas las pantallas de [secciones] en cada tamaño y escala de
/// letra, con el estudiante de ejemplo, y falla si alguna se desborda (o
/// lanza cualquier otro error al dibujarse). Las pantallas de una evaluación
/// o práctica en curso se ven aquí sin ella; con contenido las recorren sus
/// propias pruebas con la letra al doble.
void main() {
  for (final MapEntry(key: nombre, value: tamano) in _tamanos.entries) {
    for (final escala in _escalas) {
      testWidgets('ninguna pantalla se desborda en $nombre con la letra a '
          '$escala', (tester) async {
        final contenedor = crearContenedor(sesion: sesionDeEjemplo);
        await iniciarApp(tester, contenedor);
        tester.view.physicalSize = tamano;
        tester.platformDispatcher.textScaleFactorTestValue = escala;
        addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);

        final conProblemas = <String, Object>{};
        for (final seccion in secciones) {
          await ir(tester, contenedor, seccion.ruta);
          if (tester.takeException() case final Object error) {
            conProblemas[seccion.ruta] = error;
          }
        }

        expect(conProblemas, isEmpty);
      });
    }
  }
}
