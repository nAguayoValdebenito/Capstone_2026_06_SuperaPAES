import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:supera_paes/nucleo/constantes.dart';
import 'package:supera_paes/presentacion/comunes/esqueleto_con_pestanas.dart';
import 'package:supera_paes/presentacion/comunes/secciones.dart';

/// Enrutador de la app: las pestañas comparten la barra inferior y el resto de
/// las pantallas se abre a pantalla completa. Todo sale de [secciones].
final enrutadorProvider = Provider<GoRouter>((ref) {
  final enrutador = GoRouter(
    initialLocation: Rutas.ingreso,
    routes: [
      StatefulShellRoute.indexedStack(
        builder: (context, state, navegacion) =>
            EsqueletoConPestanas(navegacion: navegacion),
        branches: [
          for (final pestana in pestanas)
            StatefulShellBranch(
              routes: [
                GoRoute(
                  path: pestana.ruta,
                  builder: (context, state) => pestana.pantalla(),
                ),
              ],
            ),
        ],
      ),
      for (final seccion in secciones)
        if (!seccion.esPestana)
          GoRoute(
            path: seccion.ruta,
            builder: (context, state) => seccion.pantalla(),
          ),
    ],
  );
  ref.onDispose(enrutador.dispose);
  return enrutador;
});
