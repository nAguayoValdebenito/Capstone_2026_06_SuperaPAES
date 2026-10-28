import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:supera_paes/nucleo/constantes.dart';
import 'package:supera_paes/nucleo/errores.dart';
import 'package:supera_paes/presentacion/comunes/en_construccion.dart';
import 'package:supera_paes/presentacion/practicar/estado_practica.dart';

/// Pantalla Pregunta (provisional hasta HU-34, paso 14). Con una práctica en
/// curso, «Terminar práctica» la cierra y abre su resumen (A21).
class PantallaPregunta extends ConsumerWidget {
  const PantallaPregunta({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final enCurso = ref.watch(practicaProvider).enCurso;
    return EnConstruccion(
      descripcion:
          'Lee la pregunta y elige una alternativa. La corrección la hace el '
          'servidor al responder.',
      acciones: const [
        AccionNavegacion('Responder (provisional)', Rutas.correccion),
      ],
      hijos: [
        if (enCurso != null) ...[
          const SizedBox(height: 16),
          OutlinedButton(
            onPressed: () async {
              try {
                await ref.read(practicaProvider.notifier).cerrar();
                if (context.mounted) context.go(Rutas.resumenPractica);
              } on ErrorApi catch (error) {
                if (context.mounted) {
                  ScaffoldMessenger.of(
                    context,
                  ).showSnackBar(SnackBar(content: Text(error.mensaje)));
                }
              }
            },
            child: Text(
              'Terminar práctica (provisional, ${enCurso.cantidad} '
              'preguntas)',
            ),
          ),
        ],
      ],
    );
  }
}
