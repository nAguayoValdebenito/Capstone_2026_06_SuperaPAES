import 'package:flutter/material.dart';

import 'package:supera_paes/nucleo/constantes.dart';
import 'package:supera_paes/presentacion/comunes/en_construccion.dart';

/// Pantalla Pregunta (provisional).
class PantallaPregunta extends StatelessWidget {
  const PantallaPregunta({super.key});

  @override
  Widget build(BuildContext context) {
    return const EnConstruccion(
      descripcion:
          'Lee la pregunta y elige una alternativa. La corrección la hace el '
          'servidor al responder.',
      acciones: [AccionNavegacion('Responder (provisional)', Rutas.correccion)],
    );
  }
}
