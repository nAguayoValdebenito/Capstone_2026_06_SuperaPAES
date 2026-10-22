import 'package:flutter/material.dart';

import 'package:supera_paes/nucleo/constantes.dart';
import 'package:supera_paes/presentacion/comunes/en_construccion.dart';

/// Pantalla Iniciar sesión (A03, provisional), con el logo (DAS 7.5).
class PantallaIngreso extends StatelessWidget {
  const PantallaIngreso({super.key});

  /// Logo oficial (Figura 63 del DAS), empaquetado con la app.
  static const String logo = 'assets/imagenes/logo_supera_paes.png';

  @override
  Widget build(BuildContext context) {
    return EnConstruccion(
      encabezado: Center(
        child: Image.asset(
          logo,
          // Proporción del logo (991 × 823): reserva su lugar antes de cargar.
          width: 180,
          height: 150,
          semanticLabel: Textos.nombreApp,
        ),
      ),
      descripcion:
          'Ingresa con tu correo y contraseña para seguir practicando.',
      acciones: const [
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
