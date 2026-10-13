import 'package:flutter/material.dart';
import 'package:supera_paes/nucleo/constantes.dart';
import 'package:supera_paes/presentacion/comunes/en_construccion.dart';

/// Pantalla Términos y condiciones (provisional).
class PantallaTerminos extends StatelessWidget {
  const PantallaTerminos({super.key});

  @override
  Widget build(BuildContext context) {
    return const EnConstruccion(
      descripcion: 'Términos y condiciones de uso de ${Textos.nombreApp}.',
    );
  }
}
