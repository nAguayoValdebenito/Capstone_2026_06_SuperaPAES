import 'package:flutter/material.dart';

import 'package:supera_paes/presentacion/comunes/en_construccion.dart';

/// Pantalla Mini-ensayos y ensayo (provisional).
class PantallaEnsayos extends StatelessWidget {
  const PantallaEnsayos({super.key});

  @override
  Widget build(BuildContext context) {
    return const EnConstruccion(
      descripcion:
          'Mini-ensayos y ensayos completos con tiempo, con el formato oficial '
          'de cada prueba.',
    );
  }
}
