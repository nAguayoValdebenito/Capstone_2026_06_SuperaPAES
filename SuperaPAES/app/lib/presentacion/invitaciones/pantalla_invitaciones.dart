import 'package:flutter/material.dart';

import 'package:supera_paes/presentacion/comunes/en_construccion.dart';

/// Pantalla Invitaciones (provisional).
class PantallaInvitaciones extends StatelessWidget {
  const PantallaInvitaciones({super.key});

  @override
  Widget build(BuildContext context) {
    return const EnConstruccion(
      descripcion:
          'Comparte tu código: ganas 5 preguntas extra por cada persona que se '
          'registre con él y verifique su correo.',
    );
  }
}
