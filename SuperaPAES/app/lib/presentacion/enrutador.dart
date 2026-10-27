import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:supera_paes/dominio/entidades/perfil_estudiante.dart';
import 'package:supera_paes/dominio/entidades/sesion_estudiante.dart';
import 'package:supera_paes/nucleo/constantes.dart';
import 'package:supera_paes/presentacion/comunes/esqueleto_con_pestanas.dart';
import 'package:supera_paes/presentacion/comunes/estado_cuenta.dart';
import 'package:supera_paes/presentacion/comunes/secciones.dart';
import 'package:supera_paes/presentacion/perfil_estudio/estado_perfil.dart';

/// Pantallas que no exigen sesión.
const Set<String> rutasPublicas = {
  Rutas.ingreso,
  Rutas.crearCuenta,
  Rutas.recuperarContrasena,
  Rutas.terminos,
  Rutas.privacidad,
};

/// Adónde va la app según la sesión (HU-02): mientras se lee la sesión
/// guardada, a Cargando; sin sesión, solo a las pantallas públicas; con
/// sesión, Iniciar sesión lleva a Inicio. Crear cuenta no redirige con
/// sesión, porque el registro la abre justo antes de ir a Verificar correo.
/// Con el perfil sin completar, lleva al primer paso del perfil (CU-05 paso
/// 1); Verificar correo y las pantallas públicas siguen abiertas.
String? redirigirSegunSesion(
  AsyncValue<SesionEstudiante?> sesion,
  String ruta, {
  PerfilEstudiante? perfil,
}) {
  if (!sesion.hasValue && !sesion.hasError) {
    return ruta == Rutas.cargando ? null : Rutas.cargando;
  }
  final conSesion = sesion.value != null;
  if (ruta == Rutas.cargando) return conSesion ? Rutas.inicio : Rutas.ingreso;
  if (!conSesion && !rutasPublicas.contains(ruta)) return Rutas.ingreso;
  if (conSesion && ruta == Rutas.ingreso) return Rutas.inicio;
  if (conSesion && perfil != null && !perfil.completo) {
    final libre =
        rutasPublicas.contains(ruta) ||
        rutasPerfilDeEstudio.contains(ruta) ||
        ruta == Rutas.verificarCorreo;
    if (!libre) return Rutas.perfilCurso;
  }
  return null;
}

/// Enrutador de la app: las pestañas comparten la barra inferior y el resto de
/// las pantallas se abre a pantalla completa. Todo sale de [secciones].
final enrutadorProvider = Provider<GoRouter>((ref) {
  // Cada cambio de la sesión o del perfil vuelve a evaluar la redirección.
  final cambiosSesion = ValueNotifier<int>(0);
  ref
    ..listen(sesionProvider, (_, _) => cambiosSesion.value++)
    ..listen(perfilProvider, (_, _) => cambiosSesion.value++)
    ..onDispose(cambiosSesion.dispose);

  final enrutador = GoRouter(
    initialLocation: Rutas.ingreso,
    refreshListenable: cambiosSesion,
    redirect: (context, state) => redirigirSegunSesion(
      ref.read(sesionProvider),
      state.matchedLocation,
      perfil: ref.read(perfilProvider).value,
    ),
    routes: [
      GoRoute(
        path: Rutas.cargando,
        builder: (context, state) => const _PantallaCargando(),
      ),
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

class _PantallaCargando extends StatelessWidget {
  const _PantallaCargando();

  @override
  Widget build(BuildContext context) {
    return const Scaffold(body: Center(child: CircularProgressIndicator()));
  }
}
