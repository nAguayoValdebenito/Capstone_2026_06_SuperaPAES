import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:supera_paes/nucleo/tema.dart';
import 'package:supera_paes/presentacion/comunes/barra_inferior.dart';
import 'package:supera_paes/presentacion/comunes/estado_cuenta.dart';
import 'package:supera_paes/presentacion/comunes/secciones.dart';
import 'package:supera_paes/presentacion/perfil_estudio/estado_perfil.dart';

/// Barra inferior con las pestañas Inicio, Practicar, Evaluaciones, Progreso
/// y Perfil (DAS 7.4). Cada pestaña conserva su propio estado al cambiar
/// entre ellas; la activa lleva su ícono relleno y su texto en azul.
class EsqueletoConPestanas extends ConsumerWidget {
  const EsqueletoConPestanas({required this.navegacion, super.key});

  final StatefulNavigationShell navegacion;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Los documentos legales son públicos y también se abren en el registro.
    final conBarra =
        ref.watch(sesionProvider).value != null &&
        ref.watch(perfilProvider).value?.completo != false;
    void seleccionar(int indice) => navegacion.goBranch(
      indice,
      initialLocation: indice == navegacion.currentIndex,
    );
    return Scaffold(
      body: navegacion,
      bottomNavigationBar: !conBarra
          ? null
          : MediaQuery.sizeOf(context).shortestSide < TemaSuperaPaes.anchoTablet
          ? BarraInferior(
              seleccionada: navegacion.currentIndex,
              alSeleccionar: seleccionar,
            )
          : NavigationBar(
              selectedIndex: navegacion.currentIndex,
              onDestinationSelected: seleccionar,
              destinations: [
                for (final pestana in pestanas)
                  NavigationDestination(
                    icon: Icon(pestana.icono),
                    selectedIcon: Icon(pestana.iconoActivo ?? pestana.icono),
                    label: pestana.etiquetaPestana ?? pestana.titulo,
                  ),
              ],
            ),
    );
  }
}
