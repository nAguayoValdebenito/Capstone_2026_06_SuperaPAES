import 'dart:math' as math;

import 'package:flutter/material.dart';

import 'package:supera_paes/nucleo/tema.dart';

/// El trazo que sube del logo: un check cuyo brazo derecho termina en una
/// flecha hacia arriba, el camino de 100 a 1.000 puntos. Es el símbolo que se
/// repite en la app (vacíos, errores, logros y la barra de avance) y se dibuja
/// con código, sin imágenes (plan de mejora visual del 02/11). Es decorativo:
/// el texto de al lado dice lo que pasa.
class Trazo extends StatelessWidget {
  const Trazo({
    super.key,
    this.ancho = 72,
    this.color = TemaSuperaPaes.logoCeleste,
    this.avance = 1,
  });

  /// Ancho del dibujo; el alto es el 80 % del ancho, como en el logo.
  final double ancho;
  final Color color;

  /// Cuánto del trazo se dibuja, de 0 a 1 (la flecha aparece al final), para
  /// animarlo de izquierda a derecha.
  final double avance;

  @override
  Widget build(BuildContext context) {
    return ExcludeSemantics(
      child: RepaintBoundary(
        child: CustomPaint(
          size: Size(ancho, ancho * 0.8),
          painter: PintorTrazo(color: color, avance: avance),
        ),
      ),
    );
  }
}

/// Dibuja [Trazo] en cualquier tamaño.
class PintorTrazo extends CustomPainter {
  const PintorTrazo({required this.color, this.avance = 1});

  final Color color;
  final double avance;

  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width;
    final h = size.height;
    final grosor = h * 0.14;
    // Del logo: entra por la izquierda, baja en curva hasta el vértice del
    // check y sube recto hacia la derecha.
    final camino = Path()
      ..moveTo(w * 0.06, h * 0.36)
      ..quadraticBezierTo(w * 0.30, h * 0.40, w * 0.42, h * 0.86)
      ..lineTo(w * 0.80, h * 0.24);
    final pincel = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = grosor
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;

    final medida = camino.computeMetrics().single;
    final largo = medida.length * avance.clamp(0, 1);
    if (largo <= 0) return;
    canvas.drawPath(medida.extractPath(0, largo), pincel);
    if (avance < 1) return;

    // Punta de la flecha, en la dirección del brazo que sube.
    const fin = Offset(0.80, 0.24);
    final punta = Offset(w * 0.96, h * 0.04);
    final direccion = math.atan2(punta.dy - h * fin.dy, punta.dx - w * fin.dx);
    final ala = grosor * 1.5;
    final base = Offset(w * fin.dx, h * fin.dy);
    canvas.drawPath(
      Path()
        ..moveTo(punta.dx, punta.dy)
        ..lineTo(
          base.dx + ala * math.cos(direccion + math.pi / 2),
          base.dy + ala * math.sin(direccion + math.pi / 2),
        )
        ..lineTo(
          base.dx + ala * math.cos(direccion - math.pi / 2),
          base.dy + ala * math.sin(direccion - math.pi / 2),
        )
        ..close(),
      Paint()..color = color,
    );
  }

  @override
  bool shouldRepaint(PintorTrazo anterior) =>
      anterior.color != color || anterior.avance != avance;
}
