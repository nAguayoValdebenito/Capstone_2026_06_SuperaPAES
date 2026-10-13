import 'package:flutter/material.dart';

import 'package:supera_paes/nucleo/constantes.dart';
import 'package:supera_paes/presentacion/comunes/en_construccion.dart';

/// Pantalla Corrección (provisional).
class PantallaCorreccion extends StatelessWidget {
  const PantallaCorreccion({super.key});

  @override
  Widget build(BuildContext context) {
    return const EnConstruccion(
      descripcion:
          'Aquí verás si acertaste, la alternativa correcta y la explicación '
          'de cada alternativa.',
      acciones: [
        AccionNavegacion('Siguiente pregunta (provisional)', Rutas.pregunta),
      ],
    );
  }
}
