import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import 'package:supera_paes/presentacion/comunes/secciones.dart';

/// Barra inferior con las pestañas Inicio, Practicar, Progreso y Planes.
/// Cada pestaña conserva su propio estado al cambiar entre ellas.
class EsqueletoConPestanas extends StatelessWidget {
  const EsqueletoConPestanas({required this.navegacion, super.key});

  final StatefulNavigationShell navegacion;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: navegacion,
      bottomNavigationBar: NavigationBar(
        selectedIndex: navegacion.currentIndex,
        onDestinationSelected: (indice) => navegacion.goBranch(
          indice,
          // Tocar la pestaña activa vuelve a su pantalla inicial.
          initialLocation: indice == navegacion.currentIndex,
        ),
        destinations: [
          for (final pestana in pestanas)
            NavigationDestination(
              icon: Icon(pestana.icono),
              label: pestana.etiquetaPestana ?? pestana.titulo,
            ),
        ],
      ),
    );
  }
}
