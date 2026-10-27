import 'package:flutter/material.dart';

import 'package:supera_paes/presentacion/comunes/en_construccion.dart';

/// Mis datos y privacidad (A39, provisional), desde Perfil: puntajes PAES
/// declarados (HU-41), descarga de datos (HU-07), solicitudes de derechos
/// (HU-09) y borrado de la cuenta (HU-08).
class PantallaMisDatos extends StatelessWidget {
  const PantallaMisDatos({super.key});

  static const _apartados = [
    (
      'Puntajes PAES',
      'Puntajes reales que quieras declarar (100 a 1.000). Son opcionales y '
          'solo se usan en métricas agregadas con tu permiso.',
    ),
    (
      'Solicitudes sobre mis datos',
      'Pide acceso, rectificación, portabilidad u otros derechos sobre tus '
          'datos personales.',
    ),
    ('Borrar mi cuenta', 'Elimina tu cuenta y tus datos personales.'),
  ];

  @override
  Widget build(BuildContext context) {
    final textos = Theme.of(context).textTheme;
    return EnConstruccion(
      descripcion: 'Tus datos personales y tus derechos sobre ellos.',
      hijos: [
        for (final (titulo, detalle) in _apartados) ...[
          const SizedBox(height: 20),
          Text(titulo, style: textos.titleMedium),
          const SizedBox(height: 4),
          Text(detalle, style: textos.bodyMedium),
        ],
      ],
    );
  }
}
