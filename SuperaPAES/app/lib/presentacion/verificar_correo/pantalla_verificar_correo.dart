import 'package:flutter/material.dart';

import 'package:supera_paes/nucleo/constantes.dart';
import 'package:supera_paes/presentacion/comunes/en_construccion.dart';

/// Pantalla Verificar correo (provisional).
class PantallaVerificarCorreo extends StatelessWidget {
  const PantallaVerificarCorreo({super.key});

  @override
  Widget build(BuildContext context) {
    return const EnConstruccion(
      descripcion:
          'Te enviamos un enlace a tu correo. Al verificarlo, tu cupo diario '
          'sube de 10 a 20 preguntas.',
      acciones: [
        AccionNavegacion(
          'Continuar (provisional)',
          Rutas.inicio,
          reemplazar: true,
        ),
      ],
    );
  }
}
