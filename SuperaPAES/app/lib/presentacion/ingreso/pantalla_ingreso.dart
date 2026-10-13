import 'package:flutter/material.dart';

import 'package:supera_paes/nucleo/constantes.dart';
import 'package:supera_paes/presentacion/comunes/en_construccion.dart';

/// Pantalla Iniciar sesión (provisional).
class PantallaIngreso extends StatelessWidget {
  const PantallaIngreso({super.key});

  @override
  Widget build(BuildContext context) {
    return const EnConstruccion(
      descripcion:
          'Ingresa con tu correo y contraseña para seguir practicando.',
      acciones: [
        AccionNavegacion(
          'Entrar (provisional)',
          Rutas.inicio,
          reemplazar: true,
        ),
        AccionNavegacion('Crear cuenta', Rutas.crearCuenta),
      ],
    );
  }
}
