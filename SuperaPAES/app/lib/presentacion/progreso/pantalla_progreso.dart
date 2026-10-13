import 'package:flutter/material.dart';

import 'package:supera_paes/presentacion/comunes/en_construccion.dart';

/// Pantalla Progreso (provisional).
class PantallaProgreso extends StatelessWidget {
  const PantallaProgreso({super.key});

  @override
  Widget build(BuildContext context) {
    return const EnConstruccion(
      descripcion:
          'Tu avance por eje y por habilidad, con los temas que conviene '
          'reforzar.',
    );
  }
}
