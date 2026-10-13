import 'package:flutter/material.dart';

import 'package:supera_paes/nucleo/constantes.dart';
import 'package:supera_paes/presentacion/comunes/en_construccion.dart';

/// Pantalla Cupo agotado (provisional).
class PantallaCupoAgotado extends StatelessWidget {
  const PantallaCupoAgotado({super.key});

  @override
  Widget build(BuildContext context) {
    return const EnConstruccion(
      descripcion:
          'Usaste tus preguntas de hoy. El cupo se renueva a las 00:00 (hora '
          'de Chile). Puedes invitar a otras personas o suscribirte para '
          'seguir practicando.',
      acciones: [
        AccionNavegacion('Invitar a alguien', Rutas.invitaciones),
        AccionNavegacion('Ver planes', Rutas.planes, reemplazar: true),
      ],
    );
  }
}
