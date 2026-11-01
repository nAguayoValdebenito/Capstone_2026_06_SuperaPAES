import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:supera_paes/nucleo/tema.dart';
import 'package:supera_paes/presentacion/practicar/estado_practica.dart';

/// Las condiciones de toda evaluación con tiempo antes de fijar la hora de
/// término (A26 y su versión del ensayo; CU-10 pasos 3 y 4): el reloj sigue
/// corriendo (RN-21), las respuestas se cambian hasta entregar y las
/// omitidas cuentan como incorrectas (RN-22).
const List<Widget> condicionesConTiempo = [
  CondicionEvaluacion(
    icono: Icons.timer_outlined,
    texto:
        'El reloj sigue corriendo aunque cierres la app. Al acabarse el '
        'tiempo, se entrega solo.',
  ),
  CondicionEvaluacion(
    icono: Icons.edit_outlined,
    texto: 'Puedes cambiar tus respuestas hasta entregar. Se corrige al final.',
  ),
  CondicionEvaluacion(
    icono: Icons.remove_circle_outline,
    texto:
        'Las que dejes sin responder cuentan como incorrectas y pasan a tu '
        'repaso.',
  ),
];

/// RN-19: la práctica o el repaso abiertos se cierran al empezar; `null`
/// si no hay ninguno.
String? avisoDeCierre(WidgetRef ref) {
  final abierta = ref.watch(evaluacionAbiertaProvider).value?.abierta;
  if (abierta == null || abierta.conTiempo) return null;
  return 'Tu ${abierta.tipoNombre.toLowerCase()} sin terminar se cerrará y '
      'conservará lo respondido.';
}

/// Una condición con su ícono a la izquierda.
class CondicionEvaluacion extends StatelessWidget {
  const CondicionEvaluacion({
    required this.icono,
    required this.texto,
    super.key,
  });

  final IconData icono;
  final String texto;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icono, size: 20, color: TemaSuperaPaes.primario),
        const SizedBox(width: 12),
        Expanded(child: Text(texto, style: TemaSuperaPaes.cuerpo)),
      ],
    );
  }
}
