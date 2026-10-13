import 'package:flutter/material.dart';

import 'package:supera_paes/nucleo/constantes.dart';
import 'package:supera_paes/presentacion/comunes/en_construccion.dart';

/// Pantalla Crear cuenta (provisional).
class PantallaCrearCuenta extends StatelessWidget {
  const PantallaCrearCuenta({super.key});

  @override
  Widget build(BuildContext context) {
    return const EnConstruccion(
      descripcion:
          'Crea tu cuenta con tu nombre, correo y contraseña. Debes tener 14 '
          'años o más y aceptar los términos y la política de privacidad.',
      acciones: [
        AccionNavegacion('Ver términos y condiciones', Rutas.terminos),
        AccionNavegacion('Ver política de privacidad', Rutas.privacidad),
        AccionNavegacion(
          'Crear cuenta (provisional)',
          Rutas.verificarCorreo,
          reemplazar: true,
        ),
      ],
    );
  }
}
