import 'package:flutter/material.dart';

import 'package:supera_paes/presentacion/comunes/en_construccion.dart';

/// Pantalla Planes (provisional).
class PantallaPlanes extends StatelessWidget {
  const PantallaPlanes({super.key});

  @override
  Widget build(BuildContext context) {
    return const EnConstruccion(
      descripcion:
          'Planes Una prueba y Todas las pruebas, mensuales o anuales. La '
          'compra y la cancelación se hacen en Google Play o en la App Store.',
    );
  }
}
