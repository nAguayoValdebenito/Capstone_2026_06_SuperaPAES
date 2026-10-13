import 'package:flutter/material.dart';
import 'package:supera_paes/nucleo/constantes.dart';
import 'package:supera_paes/presentacion/comunes/en_construccion.dart';

/// Pantalla Política de privacidad (provisional).
class PantallaPrivacidad extends StatelessWidget {
  const PantallaPrivacidad({super.key});

  @override
  Widget build(BuildContext context) {
    return const EnConstruccion(
      descripcion:
          'Cómo ${Textos.nombreApp} trata tus datos personales y cómo ejercer '
          'tus derechos según la Ley 21.719.',
    );
  }
}
