import 'package:flutter/material.dart';

import 'package:supera_paes/presentacion/comunes/en_construccion.dart';

/// Pantalla Repaso de errores (provisional).
class PantallaRepaso extends StatelessWidget {
  const PantallaRepaso({super.key});

  @override
  Widget build(BuildContext context) {
    return const EnConstruccion(
      descripcion: 'Vuelve a responder las preguntas que fallaste.',
    );
  }
}
