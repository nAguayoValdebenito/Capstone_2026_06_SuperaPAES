import 'package:flutter/material.dart';

import 'package:supera_paes/nucleo/errores.dart';
import 'package:supera_paes/presentacion/comunes/componentes.dart';

/// Lo que no se pudo cargar (Progreso, A41): el mensaje de la API, o
/// [mensaje] si el error es otro, y «Reintentar».
class ErrorConReintento extends StatelessWidget {
  const ErrorConReintento({
    required this.error,
    required this.mensaje,
    required this.alReintentar,
    super.key,
  });

  final Object error;
  final String mensaje;
  final VoidCallback alReintentar;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Aviso(
          tono: TonoAviso.error,
          texto: switch (error) {
            final ErrorApi api => api.mensaje,
            _ => mensaje,
          },
        ),
        const SizedBox(height: 12),
        OutlinedButton(
          onPressed: alReintentar,
          child: const Text('Reintentar'),
        ),
      ],
    );
  }
}
