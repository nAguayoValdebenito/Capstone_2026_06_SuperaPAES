import 'package:flutter/material.dart';

import 'package:supera_paes/nucleo/tema.dart';

/// Glifos propios: las cinco pruebas y las cinco pestañas, dibujados
/// con `CustomPainter` en una cuadrícula de 24, con el mismo trazo redondeado
/// que el trazo del logo. Sustituyen a los íconos genéricos de Material en lo
/// que más se ve: sellos de prueba y barra inferior.
class GlifoPrueba extends StatelessWidget {
  const GlifoPrueba(this.prueba, {super.key, this.tamano = 24, this.color});

  final Prueba prueba;
  final double tamano;
  final Color? color;

  @override
  Widget build(BuildContext context) => ExcludeSemantics(
    child: CustomPaint(
      size: Size.square(tamano),
      painter: _PintorGlifo(
        _caminosPrueba(prueba),
        color ?? prueba.tono,
        trazo: tamano < 20 ? 2.2 : 2,
      ),
    ),
  );
}

class IconoPestana extends StatelessWidget {
  const IconoPestana(
    this.indice, {
    required this.color,
    super.key,
    this.tamano = 24,
    this.activa = false,
  });

  final int indice;
  final double tamano;
  final Color color;
  final bool activa;

  @override
  Widget build(BuildContext context) => ExcludeSemantics(
    child: CustomPaint(
      size: Size.square(tamano),
      painter: _PintorGlifo(
        _caminosPestana(indice),
        color,
        trazo: activa ? 2.4 : 2,
        relleno: activa ? color.withValues(alpha: 0.16) : null,
      ),
    ),
  );
}

typedef _Dibujo = List<Path>;

Path _p(void Function(Path p) f) {
  final p = Path();
  f(p);
  return p;
}

_Dibujo _caminosPrueba(Prueba prueba) => switch (prueba) {
  // Competencia Lectora: un libro abierto de páginas curvas.
  Prueba.cl => [
    _p(
      (p) => p
        ..moveTo(12, 6.5)
        ..cubicTo(9.5, 4.6, 6, 4.4, 3, 5.4)
        ..lineTo(3, 18.4)
        ..cubicTo(6, 17.4, 9.5, 17.7, 12, 19.6)
        ..cubicTo(14.5, 17.7, 18, 17.4, 21, 18.4)
        ..lineTo(21, 5.4)
        ..cubicTo(18, 4.4, 14.5, 4.6, 12, 6.5)
        ..close(),
    ),
    _p(
      (p) => p
        ..moveTo(12, 6.5)
        ..lineTo(12, 19.6),
    ),
  ],
  // Matemática 1: una raíz cuadrada sobre x.
  Prueba.m1 => [
    _p(
      (p) => p
        ..moveTo(3, 13)
        ..lineTo(6, 13)
        ..lineTo(9.5, 20)
        ..lineTo(14, 5)
        ..lineTo(21, 5),
    ),
    _p(
      (p) => p
        ..moveTo(15, 10)
        ..lineTo(20, 16)
        ..moveTo(20, 10)
        ..lineTo(15, 16),
    ),
  ],
  // Matemática 2: una curva sobre ejes (funciones y logaritmos).
  Prueba.m2 => [
    _p(
      (p) => p
        ..moveTo(4, 3.5)
        ..lineTo(4, 20)
        ..lineTo(20.5, 20),
    ),
    _p(
      (p) => p
        ..moveTo(6.5, 17)
        ..cubicTo(8.5, 8.5, 12.5, 7, 19, 6.8),
    ),
  ],
  // Historia y Ciencias Sociales: un frontón con columnas.
  Prueba.hcs => [
    _p(
      (p) => p
        ..moveTo(3, 9)
        ..lineTo(12, 3.8)
        ..lineTo(21, 9)
        ..close(),
    ),
    _p(
      (p) => p
        ..moveTo(6, 11.5)
        ..lineTo(6, 17.5)
        ..moveTo(10, 11.5)
        ..lineTo(10, 17.5)
        ..moveTo(14, 11.5)
        ..lineTo(14, 17.5)
        ..moveTo(18, 11.5)
        ..lineTo(18, 17.5)
        ..moveTo(3.5, 20.5)
        ..lineTo(20.5, 20.5),
    ),
  ],
  // Ciencias: un matraz con su líquido.
  Prueba.cie => [
    _p(
      (p) => p
        ..moveTo(9, 3.5)
        ..lineTo(15, 3.5)
        ..moveTo(10, 3.5)
        ..lineTo(10, 9.5)
        ..lineTo(4.6, 18.4)
        ..cubicTo(3.9, 19.6, 4.7, 21, 6.1, 21)
        ..lineTo(17.9, 21)
        ..cubicTo(19.3, 21, 20.1, 19.6, 19.4, 18.4)
        ..lineTo(14, 9.5)
        ..lineTo(14, 3.5),
    ),
    _p(
      (p) => p
        ..moveTo(7.2, 15)
        ..lineTo(16.8, 15),
    ),
  ],
};

_Dibujo _caminosPestana(int i) => switch (i) {
  // Inicio: una casa de techo en punta.
  0 => [
    _p(
      (p) => p
        ..moveTo(3.5, 11)
        ..lineTo(12, 4)
        ..lineTo(20.5, 11)
        ..lineTo(20.5, 20)
        ..lineTo(14.5, 20)
        ..lineTo(14.5, 14.5)
        ..lineTo(9.5, 14.5)
        ..lineTo(9.5, 20)
        ..lineTo(3.5, 20)
        ..close(),
    ),
  ],
  // Practicar: un lápiz sobre una línea.
  1 => [
    _p(
      (p) => p
        ..moveTo(4, 20)
        ..lineTo(8, 19)
        ..lineTo(19.5, 7.5)
        ..cubicTo(20.6, 6.4, 20.6, 5.6, 19.5, 4.5)
        ..cubicTo(18.4, 3.4, 17.6, 3.4, 16.5, 4.5)
        ..lineTo(5, 16)
        ..close(),
    ),
    _p(
      (p) => p
        ..moveTo(14.5, 6.5)
        ..lineTo(17.5, 9.5),
    ),
  ],
  // Evaluaciones: un cronómetro.
  2 => [
    _p(
      (p) => p
        ..addOval(Rect.fromCircle(center: const Offset(12, 13.5), radius: 7.5)),
    ),
    _p(
      (p) => p
        ..moveTo(12, 9.5)
        ..lineTo(12, 13.5)
        ..lineTo(14.8, 15.2)
        ..moveTo(9.5, 3)
        ..lineTo(14.5, 3)
        ..moveTo(12, 3)
        ..lineTo(12, 6),
    ),
  ],
  // Progreso: el trazo que sube, con su flecha.
  3 => [
    _p(
      (p) => p
        ..moveTo(3, 11)
        ..quadraticBezierTo(7, 11.6, 9, 18.5)
        ..lineTo(15.5, 8.5),
    ),
    _p(
      (p) => p
        ..moveTo(21, 4)
        ..lineTo(14.5, 6.2)
        ..lineTo(18.6, 11)
        ..close(),
    ),
  ],
  // Perfil: una persona.
  _ => [
    _p(
      (p) =>
          p..addOval(Rect.fromCircle(center: const Offset(12, 8), radius: 4)),
    ),
    _p(
      (p) => p
        ..moveTo(4.5, 20.5)
        ..cubicTo(4.5, 15.8, 8, 14.2, 12, 14.2)
        ..cubicTo(16, 14.2, 19.5, 15.8, 19.5, 20.5),
    ),
  ],
};

class _PintorGlifo extends CustomPainter {
  const _PintorGlifo(this.caminos, this.color, {this.trazo = 2, this.relleno});

  final _Dibujo caminos;
  final Color color;
  final double trazo;
  final Color? relleno;

  @override
  void paint(Canvas canvas, Size size) {
    canvas.scale(size.width / 24, size.height / 24);
    final linea = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = trazo
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;
    for (var k = 0; k < caminos.length; k++) {
      if (relleno != null && k == 0) {
        canvas.drawPath(caminos[k], Paint()..color = relleno!);
      }
      canvas.drawPath(caminos[k], linea);
    }
  }

  @override
  bool shouldRepaint(_PintorGlifo a) =>
      a.color != color || a.trazo != trazo || a.relleno != relleno;
}
