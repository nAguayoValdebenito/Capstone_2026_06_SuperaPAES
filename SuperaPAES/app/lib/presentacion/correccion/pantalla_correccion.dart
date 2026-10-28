import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:supera_paes/nucleo/constantes.dart';
import 'package:supera_paes/presentacion/comunes/en_construccion.dart';
import 'package:supera_paes/presentacion/practicar/estado_practica.dart';
import 'package:supera_paes/presentacion/pregunta/pantalla_pregunta.dart';

/// Pantalla Corrección (provisional hasta HU-32.2, paso 16): dice si la
/// respuesta fue correcta, muestra la explicación y sigue con la siguiente
/// pregunta o, después de la última, con el resumen.
class PantallaCorreccion extends ConsumerWidget {
  const PantallaCorreccion({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ultima = ref.watch(practicaProvider).correccion;
    return EnConstruccion(
      descripcion:
          'Aquí verás si acertaste, la alternativa correcta y la explicación '
          'de cada alternativa.',
      hijos: [
        if (ultima case (:final correccion, :final eraLaUltima)) ...[
          const SizedBox(height: 16),
          Text(
            correccion.esCorrecta
                ? 'Respuesta correcta.'
                : 'Respuesta incorrecta.',
            style: Theme.of(context).textTheme.titleMedium,
          ),
          if (correccion.explicacion case final explicacion?) ...[
            const SizedBox(height: 8),
            Text(explicacion),
          ],
          const SizedBox(height: 16),
          FilledButton(
            onPressed: eraLaUltima
                ? () => terminarPractica(context, ref, preguntar: false)
                : () {
                    ref.read(practicaProvider.notifier).seguir();
                    ref.invalidate(preguntaActualProvider);
                    context.go(Rutas.pregunta);
                  },
            child: Text(eraLaUltima ? 'Ver resumen' : 'Siguiente pregunta'),
          ),
        ],
      ],
    );
  }
}
