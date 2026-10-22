import 'package:flutter/material.dart';

import 'package:supera_paes/presentacion/comunes/en_construccion.dart';

/// Pestaña Evaluaciones (A25, provisional): diagnóstico, mini-ensayo y ensayo
/// completo con tiempo.
class PantallaEvaluaciones extends StatelessWidget {
  const PantallaEvaluaciones({super.key});

  @override
  Widget build(BuildContext context) {
    return const EnConstruccion(
      descripcion:
          'Diagnóstico, mini-ensayos y ensayo completo de cada prueba, con el '
          'tiempo y el formato oficial. Cada uno indica si está disponible '
          'según tu plan.',
    );
  }
}
