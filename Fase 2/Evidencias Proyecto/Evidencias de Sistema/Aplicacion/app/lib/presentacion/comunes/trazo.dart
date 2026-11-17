import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:supera_paes/nucleo/tema.dart';
import 'package:supera_paes/presentacion/comunes/movimiento.dart';

/// El trazo que sube del logo: un check cuyo brazo derecho termina en una
/// flecha hacia arriba, el camino de 100 a 1.000 puntos. Es el símbolo que se
/// repite en la app (vacíos, errores, logros, racha y la barra de avance) y
/// se dibuja con código, sin imágenes. Es decorativo: el texto de al lado
/// dice lo que pasa. [avance] (0 a 1) dibuja el trazo de izquierda a derecha
/// y la flecha crece al final.
class Trazo extends StatelessWidget {
  const Trazo({
    super.key,
    this.ancho = 72,
    this.color = TemaSuperaPaes.logoCeleste,
    this.avance = 1,
  });

  final double ancho;
  final Color color;
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

class PintorTrazo extends CustomPainter {
  const PintorTrazo({required this.color, this.avance = 1});

  final Color color;
  final double avance;

  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width;
    final h = size.height;
    final grosor = h * 0.14;
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
    // La punta aparece en el último 8 % del avance, creciendo desde la base.
    final punta = ((avance - 0.92) / 0.08).clamp(0.0, 1.0);
    if (punta <= 0) return;
    const fin = Offset(0.80, 0.24);
    final extremo = Offset(w * 0.96, h * 0.04);
    final base = Offset(w * fin.dx, h * fin.dy);
    final direccion = math.atan2(extremo.dy - base.dy, extremo.dx - base.dx);
    final ala = grosor * 1.5 * punta;
    final tope = Offset.lerp(base, extremo, punta)!;
    canvas.drawPath(
      Path()
        ..moveTo(tope.dx, tope.dy)
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

/// El trazo que se dibuja solo al aparecer (corrección, Mi suscripción,
/// estados vacíos). Con movimiento reducido aparece completo en el primer
/// cuadro. [hasta] es cuánto del trazo se dibuja (0 a 1) y [retraso] espera
/// antes de empezar.
class TrazoAnimado extends StatefulWidget {
  const TrazoAnimado({
    super.key,
    this.ancho = 72,
    this.color = TemaSuperaPaes.logoCeleste,
    this.hasta = 1,
    this.retraso = Duration.zero,
    this.duracionBase = TemaSuperaPaes.movimientoLento,
  });

  final double ancho;
  final Color color;
  final double hasta;
  final Duration retraso;
  final Duration duracionBase;

  @override
  State<TrazoAnimado> createState() => _TrazoAnimadoState();
}

class _TrazoAnimadoState extends State<TrazoAnimado>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this);
  late Animation<double> _avance = const AlwaysStoppedAnimation(0);
  bool _iniciado = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_iniciado) return;
    _iniciado = true;
    if (sinAnimarMomentos(context)) {
      _avance = AlwaysStoppedAnimation(widget.hasta);
      return;
    }
    // El retraso va dentro de la misma animación (sin temporizadores).
    final total = widget.retraso + widget.duracionBase;
    _c.duration = total;
    _avance = Tween<double>(begin: 0, end: widget.hasta).animate(
      CurvedAnimation(
        parent: _c,
        curve: Interval(
          widget.retraso.inMilliseconds / total.inMilliseconds,
          1,
          curve: TemaSuperaPaes.curvaEnfasis,
        ),
      ),
    );
    _c.forward();
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
    animation: _avance,
    builder: (_, _) =>
        Trazo(ancho: widget.ancho, color: widget.color, avance: _avance.value),
  );
}

/// El símbolo del logo (libro y birrete de `simbolo_sin_trazo.png`)
/// con el trazo celeste dibujado por código encima, para animarlo en la
/// apertura Con `avance: 1` es idéntico al símbolo del logo.
class SimboloLogo extends StatelessWidget {
  const SimboloLogo({
    super.key,
    this.ancho = TemaSuperaPaes.anchoSimboloApertura,
    this.avance = 1,
  });

  final double ancho;
  final double avance;

  static const Size _lienzo = Size(590, 564);

  @override
  Widget build(BuildContext context) {
    final alto = ancho * _lienzo.height / _lienzo.width;
    return Semantics(
      label: 'Supera PAES',
      image: true,
      child: SizedBox(
        width: ancho,
        height: alto,
        child: Stack(
          fit: StackFit.expand,
          children: [
            Image.asset('assets/imagenes/simbolo_sin_trazo.png'),
            RepaintBoundary(
              child: CustomPaint(painter: PintorTrazoLogo(avance: avance)),
            ),
          ],
        ),
      ),
    );
  }
}

/// El trazo del logo medido sobre el lienzo de 590 × 564 del símbolo.
class PintorTrazoLogo extends CustomPainter {
  const PintorTrazoLogo({required this.avance});

  final double avance;

  @override
  void paint(Canvas canvas, Size size) {
    canvas.scale(size.width / 590, size.height / 564);
    final pincel = Paint()
      ..color = TemaSuperaPaes.logoCeleste
      ..style = PaintingStyle.stroke
      ..strokeWidth = 50
      ..strokeCap = StrokeCap.butt
      ..strokeJoin = StrokeJoin.miter
      ..strokeMiterLimit = 3;
    final camino = Path()
      ..moveTo(54, 242)
      ..quadraticBezierTo(222, 270, 290, 408)
      ..lineTo(520, 190);
    final medida = camino.computeMetrics().single;
    final largo = medida.length * avance.clamp(0, 1);
    if (largo <= 0) return;
    canvas.drawPath(medida.extractPath(0, largo), pincel);
    final punta = ((avance - 0.9) / 0.1).clamp(0.0, 1.0);
    if (punta <= 0) return;
    const centro = Offset(540, 172);
    canvas
      ..save()
      ..translate(centro.dx, centro.dy)
      ..scale(punta)
      ..translate(-centro.dx, -centro.dy)
      ..drawPath(
        Path()
          ..moveTo(588, 100)
          ..lineTo(462, 148)
          ..lineTo(556, 236)
          ..close(),
        Paint()..color = TemaSuperaPaes.logoCeleste,
      )
      ..restore();
  }

  @override
  bool shouldRepaint(PintorTrazoLogo anterior) => anterior.avance != avance;
}
