import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supera_paes/nucleo/tema.dart';
import 'package:supera_paes/presentacion/comunes/estado_usuario.dart';

/// La misma cifra en A13, A14, A15 y A16. Nunca usa un valor de ejemplo.
class DisponibilidadPractica extends ConsumerWidget {
  const DisponibilidadPractica({required this.pruebaId, super.key});
  final int pruebaId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final estado = ref.watch(estadoUsuarioProvider).value;
    if (estado == null) return const SizedBox.shrink();
    final disponibles = estado.disponibles(pruebaId);
    final desglose = estado.bonos > 0
        ? ': ${estado.cupoRestante} del cupo diario y ${estado.bonos} extra.'
        : ' del cupo diario.';
    return Text(
      disponibles == null
          ? 'Incluida en tu plan · sin límite'
          : 'Hoy te quedan $disponibles preguntas$desglose',
      style: TemaSuperaPaes.pequeno.copyWith(
        color: TemaSuperaPaes.textoSecundario,
      ),
    );
  }
}
