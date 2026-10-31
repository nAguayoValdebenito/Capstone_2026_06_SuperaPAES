import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:supera_paes/dominio/entidades/resultado_evaluacion.dart';
import 'package:supera_paes/nucleo/constantes.dart';
import 'package:supera_paes/presentacion/comunes/componentes.dart';
import 'package:supera_paes/presentacion/comunes/error_con_reintento.dart';
import 'package:supera_paes/presentacion/resultado/estado_resultado.dart';
import 'package:supera_paes/presentacion/resultado/partes_resultado.dart';

/// Resultado de una evaluación (A30 mini-ensayo, A32 ensayo completo y A32b
/// sin tabla de conversión; HU-61 esc. 1, RF-A23, RN-22 y RN-23): correctas,
/// incorrectas y omitidas, porcentaje o puntaje estimado, tiempo usado y
/// resultado por eje y por habilidad. «Ir al historial» llega con HU-62.
class PantallaResultado extends ConsumerWidget {
  const PantallaResultado({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final resultado = ref.watch(resultadoProvider);
    final datos = resultado.value;
    return PantallaFormulario(
      separacion: 14,
      hijos: [
        Align(
          alignment: Alignment.centerLeft,
          child: TextButton.icon(
            style: TextButton.styleFrom(
              padding: const EdgeInsets.symmetric(vertical: 4),
              minimumSize: Size.zero,
              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
            ),
            onPressed: () => context.canPop()
                ? context.pop()
                : context.go(Rutas.evaluaciones),
            icon: const Icon(Icons.close, size: 20),
            label: const Text('Cerrar'),
          ),
        ),
        ...switch (resultado) {
          AsyncError(:final error) => [
            ErrorConReintento(
              error: error,
              mensaje: 'No se pudo cargar el resultado.',
              alReintentar: () => ref.invalidate(resultadoProvider),
            ),
          ],
          AsyncData(value: final ResultadoEvaluacion datos) => [
            ...ContenidoResultado.de(datos),
          ],
          AsyncData() => const [
            Encabezado(
              titulo: 'No hay un resultado para mostrar',
              bajada: 'Cuando termines una evaluación, aquí verás cómo te fue.',
            ),
          ],
          _ => const [Center(child: CircularProgressIndicator())],
        },
      ],
      pie: datos == null
          ? null
          : FilledButton(
              onPressed: () => abrirRevision(context, ref, datos.id),
              child: const Text('Revisar pregunta por pregunta'),
            ),
    );
  }
}
