import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:supera_paes/nucleo/tema.dart';
import 'package:supera_paes/presentacion/comunes/movimiento.dart';

/// Un solo pulso al activarse. Con movimiento reducido queda a escala final.
class Pulso extends StatefulWidget {
  const Pulso({
    required this.activo,
    required this.child,
    super.key,
    this.escala = TemaSuperaPaes.escalaPulsoAlternativa,
    this.tiempo = TemaSuperaPaes.movimientoRapido,
  });
  final bool activo;
  final double escala;
  final Duration tiempo;
  final Widget child;

  @override
  State<Pulso> createState() => _PulsoState();
}

class _PulsoState extends State<Pulso> with SingleTickerProviderStateMixin {
  late final _control = AnimationController(
    vsync: this,
    duration: widget.tiempo,
  );
  bool _iniciado = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (sinAnimarMomentos(context)) {
      _control
        ..stop()
        ..value = 1;
    } else if (!_iniciado && widget.activo) {
      _control.forward(from: 0);
    }
    _iniciado = true;
  }

  @override
  void didUpdateWidget(Pulso oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.activo && !oldWidget.activo && !sinAnimarMomentos(context)) {
      _control.forward(from: 0);
    }
  }

  @override
  void dispose() {
    _control.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
    animation: _control,
    child: widget.child,
    builder: (_, child) => Transform.scale(
      scale: 1 + (widget.escala - 1) * math.sin(math.pi * _control.value),
      child: child,
    ),
  );
}
