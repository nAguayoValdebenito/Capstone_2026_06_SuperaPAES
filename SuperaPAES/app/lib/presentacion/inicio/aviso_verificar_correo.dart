import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import 'package:supera_paes/nucleo/constantes.dart';

/// Aviso de Inicio mientras el correo no esté verificado (HU-05.2): sin
/// verificar, el cupo es de 10 preguntas diarias (RN-01). Lleva a Verificar
/// correo (A06), que se abre encima para volver a Inicio. Inicio decide
/// cuándo mostrarlo.
class AvisoVerificarCorreo extends StatelessWidget {
  const AvisoVerificarCorreo({super.key});

  @override
  Widget build(BuildContext context) {
    final tema = Theme.of(context);
    final colorTexto = tema.colorScheme.onPrimaryContainer;
    return Card(
      margin: EdgeInsets.zero,
      color: tema.colorScheme.primaryContainer,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(Icons.mark_email_unread_outlined, color: colorTexto),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    'Verifica tu correo para tener 20 preguntas diarias. Hoy '
                    'tienes 10.',
                    style: tema.textTheme.bodyLarge?.copyWith(
                      color: colorTexto,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            FilledButton(
              onPressed: () => context.push(Rutas.verificarCorreo),
              child: const Text('Verificar mi correo'),
            ),
          ],
        ),
      ),
    );
  }
}
