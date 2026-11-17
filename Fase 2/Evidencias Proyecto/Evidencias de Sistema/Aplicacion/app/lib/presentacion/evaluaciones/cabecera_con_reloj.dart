import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:supera_paes/nucleo/constantes.dart';
import 'package:supera_paes/nucleo/errores.dart';
import 'package:supera_paes/nucleo/tema.dart';
import 'package:supera_paes/presentacion/comunes/componentes.dart';
import 'package:supera_paes/presentacion/evaluaciones/estado_evaluaciones.dart';
import 'package:supera_paes/presentacion/evaluaciones/reloj_evaluacion.dart';
import 'package:supera_paes/presentacion/perfil_estudio/estado_perfil.dart';
import 'package:supera_paes/presentacion/resultado/estado_resultado.dart';

/// Entrega la evaluación y abre su resultado (A30). Al acabarse el tiempo
/// se entrega sola (RN-21) y el servidor la cierra como tiempo agotado. Si
/// no se pudo, avisa y la evaluación sigue abierta para volver a intentarlo.
Future<void> entregarEvaluacion(BuildContext context, WidgetRef ref) async {
  try {
    final id = await ref.read(evaluacionConTiempoProvider.notifier).entregar();
    if (!context.mounted) return;
    ref.read(evaluacionConsultadaProvider.notifier).evaluacion = id;
    context.go(Rutas.resultado);
  } on ErrorApi catch (error) {
    if (context.mounted) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(error.mensaje)));
    }
  }
}

/// «✕ Salir», «Mini-ensayo · M1» y el reloj, arriba de A27 y A28. Salir no
/// pierde nada: el reloj sigue y la evaluación se retoma desde Inicio o
/// Evaluaciones (A29).
class CabeceraConReloj extends ConsumerStatefulWidget {
  const CabeceraConReloj({super.key});

  @override
  ConsumerState<CabeceraConReloj> createState() => _CabeceraConRelojState();
}

class _CabeceraConRelojState extends ConsumerState<CabeceraConReloj> {
  String? _aviso;

  @override
  Widget build(BuildContext context) {
    final enCurso = ref.watch(evaluacionConTiempoProvider);
    if (enCurso == null) return const SizedBox.shrink();
    final prueba = ref
        .watch(opcionesPerfilProvider)
        .value
        ?.prueba(enCurso.evaluacion.pruebaId);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Wrap(
          alignment: WrapAlignment.spaceBetween,
          crossAxisAlignment: WrapCrossAlignment.center,
          spacing: 8,
          runSpacing: 8,
          children: [
            TextButton.icon(
              style: TextButton.styleFrom(
                padding: const EdgeInsets.symmetric(vertical: 4),
                minimumSize: Size.zero,
                tapTargetSize: MaterialTapTargetSize.padded,
              ),
              onPressed: () => context.go(Rutas.evaluaciones),
              icon: const Icon(Icons.close, size: 20),
              label: const Text('Salir'),
            ),
            Text(
              [enCurso.evaluacion.tipoNombre, ?prueba?.nombreCorto].join(' · '),
              style: TemaSuperaPaes.pequenoFuerte,
            ),
            RelojEvaluacion(
              alVencer: () => unawaited(entregarEvaluacion(context, ref)),
              alAviso: (aviso) {
                if (mounted) setState(() => _aviso = aviso);
              },
            ),
          ],
        ),
        if (_aviso != null) ...[
          const SizedBox(height: 8),
          Aviso(tono: TonoAviso.neutro, texto: _aviso!),
        ],
      ],
    );
  }
}

/// Lo que se ve en A27 o A28 si no hay una evaluación en curso (la app se
/// abrió en esa pantalla): vuelve a Evaluaciones, que ofrece retomarla.
class SinEvaluacionEnCurso extends StatelessWidget {
  const SinEvaluacionEnCurso({super.key});

  @override
  Widget build(BuildContext context) {
    return PantallaFormulario(
      hijos: [
        const SizedBox(height: 32),
        const Encabezado(
          titulo: 'No tienes una evaluación en curso',
          bajada: 'Elige una en Evaluaciones para empezar.',
        ),
        FilledButton(
          onPressed: () => context.go(Rutas.evaluaciones),
          child: const Text('Ir a Evaluaciones'),
        ),
      ],
    );
  }
}
