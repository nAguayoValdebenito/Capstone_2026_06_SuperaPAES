import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:supera_paes/nucleo/tema.dart';
import 'package:supera_paes/presentacion/comunes/movimiento.dart';
import 'package:supera_paes/presentacion/comunes/trazo.dart';

/// Las letras proceden de la correccion del servidor, nunca del enunciado.
class FranjaCorreccion extends StatefulWidget {
  const FranjaCorreccion({
    required this.acerto,
    required this.correcta,
    required this.elegida,
    super.key,
  });
  final bool acerto;
  final String correcta;
  final String elegida;
  @override
  State<FranjaCorreccion> createState() => _FranjaCorreccionState();
}

class _FranjaCorreccionState extends State<FranjaCorreccion> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      unawaited(
        widget.acerto
            ? HapticFeedback.lightImpact()
            : HapticFeedback.selectionClick(),
      );
    });
  }

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(TemaSuperaPaes.espacio24),
    decoration: BoxDecoration(
      color: widget.acerto
          ? TemaSuperaPaes.exitoSuave
          : TemaSuperaPaes.neutroSuave,
      borderRadius: BorderRadius.circular(TemaSuperaPaes.radioTarjeta),
    ),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (widget.acerto)
          TweenAnimationBuilder<double>(
            tween: Tween(begin: 0, end: 1),
            duration: duracion(context, TemaSuperaPaes.movimientoLento),
            builder: (_, valor, _) => Trazo(
              ancho: TemaSuperaPaes.anchoTrazoCorreccion,
              color: TemaSuperaPaes.exito,
              avance: sinAnimarMomentos(context) ? 1 : valor,
            ),
          )
        else
          const Icon(
            Icons.school_outlined,
            size: TemaSuperaPaes.iconoCorreccion,
            color: TemaSuperaPaes.textoSecundario,
          ),
        const SizedBox(width: 14),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                widget.acerto
                    ? '¡Bien! Era la ${widget.correcta}.'
                    : 'Era la ${widget.correcta}.',
                style: TemaSuperaPaes.h2,
              ),
              Text(
                widget.acerto
                    ? 'Respuesta correcta'
                    : 'Mira cómo se resuelve. '
                          'Tú marcaste la ${widget.elegida}.',
                style: TemaSuperaPaes.pequeno,
              ),
            ],
          ),
        ),
      ],
    ),
  );
}
