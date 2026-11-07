import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:go_router/go_router.dart';

import 'package:supera_paes/nucleo/constantes.dart';
import 'package:supera_paes/presentacion/comunes/rutas_navegacion.dart';

/// Planes se apila en el navegador de la pestaña actual, sin cambiarla.
void abrirPlanes(BuildContext context) {
  final rama = pestanaDeRuta(GoRouterState.of(context).matchedLocation);
  unawaited(context.push<void>(rutaPlanesEnRama(rama ?? Rutas.perfil)));
}

/// Conserva el shell debajo del modo concentración y reemplaza la pregunta
/// anterior al corregir o continuar, sin acumular respuestas en el historial.
void abrirConcentracion(BuildContext context, String ruta) {
  assert(rutasConcentracion.contains(ruta), 'Solo rutas de concentración.');
  if (rutasConcentracion.contains(GoRouterState.of(context).matchedLocation)) {
    context.pushReplacement(ruta);
  } else {
    unawaited(context.push<void>(ruta));
  }
}
