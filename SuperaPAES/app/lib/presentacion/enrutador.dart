import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:supera_paes/dominio/entidades/perfil_estudiante.dart';
import 'package:supera_paes/dominio/entidades/sesion_estudiante.dart';
import 'package:supera_paes/nucleo/constantes.dart';
import 'package:supera_paes/presentacion/apertura/pantalla_cargando.dart';
import 'package:supera_paes/presentacion/comunes/contenedor_pestanas.dart';
import 'package:supera_paes/presentacion/comunes/esqueleto_con_pestanas.dart';
import 'package:supera_paes/presentacion/comunes/estado_cuenta.dart';
import 'package:supera_paes/presentacion/comunes/rutas_navegacion.dart';
import 'package:supera_paes/presentacion/comunes/secciones.dart';
import 'package:supera_paes/presentacion/comunes/transiciones.dart';
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

/// Las pantallas conservan su dirección y pertenecen al navegador de su
/// pestaña. Acceso, perfil inicial y concentración usan el navegador raíz.
final enrutadorProvider = Provider<GoRouter>((ref) {
  final raiz = GlobalKey<NavigatorState>(debugLabel: 'raiz');
  final ramas = [
    for (final p in pestanas) GlobalKey<NavigatorState>(debugLabel: p.ruta),
  ];
  final planes = secciones.singleWhere((s) => s.ruta == Rutas.planes);
  // Cada cambio de la sesión o del perfil vuelve a evaluar la redirección.
  final cambiosSesion = ValueNotifier<int>(0);
  ref
    ..listen(sesionProvider, (_, _) => cambiosSesion.value++)
    ..listen(perfilProvider, (_, _) => cambiosSesion.value++)
    ..onDispose(cambiosSesion.dispose);

  final enrutador = GoRouter(
    navigatorKey: raiz,
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
        builder: (context, state) => const PantallaCargando(),
      ),
      StatefulShellRoute(
        pageBuilder: (context, state, navegacion) => paginaConMovimiento(
          context,
          state,
          EsqueletoConPestanas(navegacion: navegacion),
        ),
        navigatorContainerBuilder: (context, shell, hijos) =>
            ContenedorPestanas(seleccionada: shell.currentIndex, hijos: hijos),
        branches: [
          for (var indice = 0; indice < pestanas.length; indice++)
            StatefulShellBranch(
              navigatorKey: ramas[indice],
              initialLocation: pestanas[indice].ruta,
              routes: [
                GoRoute(
                  path: pestanas[indice].ruta,
                  pageBuilder: (context, state) => paginaConMovimiento(
                    context,
                    state,
                    pestanas[indice].pantalla(),
                  ),
                  routes: [
                    if (pestanas[indice].ruta != Rutas.perfil)
                      GoRoute(
                        path: 'planes',
                        parentNavigatorKey: ramas[indice],
                        pageBuilder: (context, state) => paginaConMovimiento(
                          context,
                          state,
                          planes.pantalla(),
                        ),
                      ),
                  ],
                ),
                for (final seccion in secciones.where(
                  (s) => !s.esPestana && s.rutaPestana == pestanas[indice].ruta,
                ))
                  GoRoute(
                    path: seccion.ruta,
                    parentNavigatorKey: ramas[indice],
                    pageBuilder: (context, state) =>
                        paginaConMovimiento(context, state, seccion.pantalla()),
                  ),
              ],
            ),
        ],
      ),
      for (final seccion in secciones)
        if (rutasSinBarra.contains(seccion.ruta))
          GoRoute(
            path: seccion.ruta,
            parentNavigatorKey: raiz,
            pageBuilder: (context, state) =>
                paginaConMovimiento(context, state, seccion.pantalla()),
          ),
    ],
  );
  ref.onDispose(enrutador.dispose);
  return enrutador;
});
