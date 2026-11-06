import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:supera_paes/nucleo/tema.dart';
import 'package:supera_paes/presentacion/comunes/movimiento.dart';
import 'package:supera_paes/presentacion/comunes/trazo.dart';

/// Respuesta al presionar. Escala 0,98 en 100 ms (vuelve en 150) con
/// `Transform`, sin mover a los vecinos; la zona táctil no se achica. Con
/// movimiento reducido queda solo la ondulación.
class Presionable extends StatefulWidget {
  const Presionable({
    required this.child,
    required this.onTap,
    super.key,
    this.radio = TemaSuperaPaes.radioGrande,
    this.etiqueta,
  });

  final Widget child;
  final VoidCallback? onTap;
  final double radio;
  final String? etiqueta;

  @override
  State<Presionable> createState() => _PresionableState();
}

class _PresionableState extends State<Presionable> {
  bool _abajo = false;

  @override
  Widget build(BuildContext context) {
    final reducir = reducirMovimiento(context);
    return Semantics(
      button: true,
      label: widget.etiqueta,
      child: AnimatedScale(
        scale: _abajo && !reducir ? 0.98 : 1,
        duration: _abajo
            ? const Duration(milliseconds: 100)
            : TemaSuperaPaes.movimientoRapido,
        curve: TemaSuperaPaes.curvaEntrada,
        child: Material(
          color: Colors.transparent,
          borderRadius: BorderRadius.circular(widget.radio),
          child: InkWell(
            borderRadius: BorderRadius.circular(widget.radio),
            onTap: widget.onTap,
            onHighlightChanged: (v) => setState(() => _abajo = v),
            child: widget.child,
          ),
        ),
      ),
    );
  }
}

/// Entrada escalonada. Fundido + 8 dp hacia arriba, 200 ms cada uno,
/// 40 ms entre ellos y tope de 6 (el resto entra con el sexto). Solo la
/// primera carga ([activo]). Con movimiento reducido todo aparece junto.
class AparecerEscalonado extends StatefulWidget {
  const AparecerEscalonado({
    required this.indice,
    required this.child,
    super.key,
    this.activo = true,
  });

  final int indice;
  final Widget child;
  final bool activo;

  @override
  State<AparecerEscalonado> createState() => _AparecerEscalonadoState();
}

class _AparecerEscalonadoState extends State<AparecerEscalonado>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this);
  late final Animation<double> _curva;
  bool _iniciado = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_iniciado) return;
    _iniciado = true;
    final base = duracion(context, TemaSuperaPaes.movimientoNormal);
    if (!widget.activo || base == Duration.zero) {
      _curva = const AlwaysStoppedAnimation(1);
      _c.value = 1;
      return;
    }
    // El retraso va dentro de una sola animación (sin temporizadores).
    final orden = math.min(widget.indice, TemaSuperaPaes.topeEscalonado - 1);
    final retraso = TemaSuperaPaes.pasoEscalonado * orden;
    final total = retraso + base;
    _c.duration = total;
    _curva = CurvedAnimation(
      parent: _c,
      curve: Interval(
        retraso.inMilliseconds / total.inMilliseconds,
        1,
        curve: TemaSuperaPaes.curvaEntrada,
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
  Widget build(BuildContext context) {
    return FadeTransition(
      opacity: _curva,
      child: AnimatedBuilder(
        animation: _curva,
        builder: (_, hijo) => Transform.translate(
          offset: Offset(
            0,
            TemaSuperaPaes.desplazamientoLista * (1 - _curva.value),
          ),
          child: hijo,
        ),
        child: widget.child,
      ),
    );
  }
}

/// Barra que se llena (400 ms) sobre un riel visible (`borde`). Dice su
/// valor al lector de pantalla. Si [valor] cambia, avanza desde donde estaba.
/// [retraso] escalona varias barras (sin temporizadores: va dentro de la
/// misma animación). Con movimiento reducido muestra la barra final.
class BarraAnimada extends StatefulWidget {
  const BarraAnimada({
    required this.valor,
    super.key,
    this.alto = TemaSuperaPaes.altoBarra,
    this.color = TemaSuperaPaes.primario,
    this.riel = TemaSuperaPaes.borde,
    this.etiquetaSemantica,
    this.retraso = Duration.zero,
    this.desde = 0,
  });

  final double valor;
  final double alto;
  final Color color;
  final Color riel;
  final String? etiquetaSemantica;
  final Duration retraso;

  /// Valor del que parte la primera vez.
  final double desde;

  @override
  State<BarraAnimada> createState() => _BarraAnimadaState();
}

class _BarraAnimadaState extends State<BarraAnimada>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this);
  late double _inicio = widget.desde;
  late double _fin = widget.valor;
  Duration _retraso = Duration.zero;
  bool _iniciado = false;

  double get _actual {
    final total = _c.duration;
    if (total == null || total == Duration.zero) return _fin;
    final t = Interval(
      _retraso.inMilliseconds / total.inMilliseconds,
      1,
      curve: TemaSuperaPaes.curvaEntrada,
    ).transform(_c.value);
    return _inicio + (_fin - _inicio) * t;
  }

  void _animar({required Duration retraso}) {
    final base = duracion(context, TemaSuperaPaes.movimientoLento);
    if (base == Duration.zero) {
      _c
        ..duration = Duration.zero
        ..value = 1;
      return;
    }
    _retraso = retraso;
    _c
      ..duration = retraso + base
      ..forward(from: 0);
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_iniciado) return;
    _iniciado = true;
    _animar(retraso: widget.retraso);
  }

  @override
  void didUpdateWidget(BarraAnimada anterior) {
    super.didUpdateWidget(anterior);
    if (anterior.valor == widget.valor) return;
    _inicio = _actual;
    _fin = widget.valor;
    _animar(retraso: Duration.zero);
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Semantics(
      value: widget.etiquetaSemantica,
      child: ExcludeSemantics(
        child: RepaintBoundary(
          child: AnimatedBuilder(
            animation: _c,
            builder: (_, _) => ClipRRect(
              borderRadius: BorderRadius.circular(widget.alto / 2),
              child: SizedBox(
                height: widget.alto,
                child: CustomPaint(
                  painter: _PintorBarra(
                    _actual.clamp(0, 1),
                    widget.color,
                    widget.riel,
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _PintorBarra extends CustomPainter {
  _PintorBarra(this.v, this.color, this.riel);

  final double v;
  final Color color;
  final Color riel;

  @override
  void paint(Canvas canvas, Size size) {
    final r = Radius.circular(size.height / 2);
    canvas.drawRRect(
      RRect.fromRectAndRadius(Offset.zero & size, r),
      Paint()..color = riel,
    );
    if (v <= 0) return;
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromLTWH(0, 0, math.max(size.height, size.width * v), size.height),
        r,
      ),
      Paint()..color = color,
    );
  }

  @override
  bool shouldRepaint(_PintorBarra a) =>
      a.v != v || a.color != color || a.riel != riel;
}

/// Número que cuenta de [desde] a [valor] con cifras tabulares
/// (no cambia de ancho). El lector de pantalla oye solo el valor final.
class ContadorAnimado extends StatelessWidget {
  const ContadorAnimado({
    required this.valor,
    required this.estilo,
    super.key,
    this.desde = 0,
    this.sufijo = '',
    this.miles = false,
    this.duracionBase = TemaSuperaPaes.movimientoFoco,
  });

  final int valor;
  final int desde;
  final TextStyle estilo;
  final String sufijo;
  final bool miles;
  final Duration duracionBase;

  String _formato(int n) {
    if (!miles || n < 1000) return '$n';
    final s = '$n';
    return '${s.substring(0, s.length - 3)}.${s.substring(s.length - 3)}';
  }

  @override
  Widget build(BuildContext context) {
    final animar = !sinAnimarMomentos(context);
    return Semantics(
      label: '${_formato(valor)}$sufijo',
      child: ExcludeSemantics(
        child: TweenAnimationBuilder<double>(
          tween: Tween(
            begin: animar ? desde.toDouble() : valor.toDouble(),
            end: valor.toDouble(),
          ),
          duration: animar ? duracionBase : Duration.zero,
          curve: TemaSuperaPaes.curvaEnfasis,
          builder: (_, v, _) => FittedBox(
            fit: BoxFit.scaleDown,
            alignment: Alignment.centerLeft,
            child: Text(
              '${_formato(v.round())}$sufijo',
              style: TemaSuperaPaes.tabular(estilo),
              maxLines: 1,
              softWrap: false,
            ),
          ),
        ),
      ),
    );
  }
}

/// Anillo de acierto que se llena en 700 ms; con [destellos], ocho
/// chispas cortas salen del anillo al terminar (600 ms, una sola vez).
class AnilloAvance extends StatefulWidget {
  const AnilloAvance({
    required this.valor,
    required this.centro,
    super.key,
    this.tamano = TemaSuperaPaes.anilloResumen,
    this.destellos = false,
    this.color = TemaSuperaPaes.primario,
  });

  final double valor;
  final Widget centro;
  final double tamano;
  final bool destellos;
  final Color color;

  @override
  State<AnilloAvance> createState() => _AnilloAvanceState();
}

class _AnilloAvanceState extends State<AnilloAvance>
    with TickerProviderStateMixin {
  late final AnimationController _llenar = AnimationController(
    vsync: this,
    duration: TemaSuperaPaes.movimientoFoco,
  );
  late final AnimationController _chispas = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 600),
  );
  bool _iniciado = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_iniciado) return;
    _iniciado = true;
    if (sinAnimarMomentos(context)) {
      _llenar.value = 1;
      return; // Sin destellos con movimiento reducido.
    }
    unawaited(
      _llenar.forward().whenComplete(() {
        if (!mounted || !widget.destellos) return;
        unawaited(HapticFeedback.lightImpact());
        _chispas.forward();
      }),
    );
  }

  @override
  void dispose() {
    _llenar.dispose();
    _chispas.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final lado = widget.tamano + 56;
    return SizedBox(
      width: lado,
      height: lado,
      child: Stack(
        alignment: Alignment.center,
        children: [
          if (widget.destellos)
            Positioned.fill(
              child: RepaintBoundary(
                child: CustomPaint(
                  painter: _PintorChispas(_chispas, widget.tamano),
                ),
              ),
            ),
          RepaintBoundary(
            child: AnimatedBuilder(
              animation: _llenar,
              builder: (_, _) => CustomPaint(
                size: Size.square(widget.tamano),
                painter: _PintorAnillo(
                  TemaSuperaPaes.curvaEnfasis.transform(_llenar.value) *
                      widget.valor,
                  widget.color,
                ),
              ),
            ),
          ),
          SizedBox(
            width: widget.tamano - 32,
            child: FittedBox(fit: BoxFit.scaleDown, child: widget.centro),
          ),
        ],
      ),
    );
  }
}

class _PintorAnillo extends CustomPainter {
  _PintorAnillo(this.v, this.color);

  final double v;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    const grosor = 12.0;
    final rect = (Offset.zero & size).deflate(grosor / 2);
    canvas.drawArc(
      rect,
      0,
      math.pi * 2,
      false,
      Paint()
        ..color = TemaSuperaPaes.primarioSuave
        ..style = PaintingStyle.stroke
        ..strokeWidth = grosor,
    );
    if (v <= 0) return;
    canvas.drawArc(
      rect,
      -math.pi / 2,
      math.pi * 2 * v,
      false,
      Paint()
        ..color = color
        ..style = PaintingStyle.stroke
        ..strokeWidth = grosor
        ..strokeCap = StrokeCap.round,
    );
  }

  @override
  bool shouldRepaint(_PintorAnillo a) => a.v != v || a.color != color;
}

class _PintorChispas extends CustomPainter {
  _PintorChispas(this.anim, this.diametro) : super(repaint: anim);

  final Animation<double> anim;
  final double diametro;

  @override
  void paint(Canvas canvas, Size size) {
    final t = anim.value;
    if (t <= 0 || t >= 1) return;
    final c = size.center(Offset.zero);
    final avance = Curves.easeOutCubic.transform(t);
    final opacidad = (1 - t).clamp(0.0, 1.0);
    for (var i = 0; i < 8; i++) {
      final ang = -math.pi / 2 + i * math.pi / 4 + math.pi / 8;
      final r0 = diametro / 2 + 6 + 10 * avance;
      final r1 = r0 + 10 * (1 - avance) + 4;
      final dir = Offset(math.cos(ang), math.sin(ang));
      final color = i.isEven
          ? TemaSuperaPaes.logoCeleste
          : TemaSuperaPaes.primario;
      canvas.drawLine(
        c + dir * r0,
        c + dir * r1,
        Paint()
          ..color = color.withValues(alpha: opacidad)
          ..strokeWidth = 4
          ..strokeCap = StrokeCap.round,
      );
    }
  }

  @override
  bool shouldRepaint(_PintorChispas a) => false;
}

/// Sacudida horizontal de 4 dp en 300 ms al fallar. Se dispara
/// cambiando [veces]. Sin movimiento con «reducir movimiento».
class Sacudida extends StatelessWidget {
  const Sacudida({required this.veces, required this.child, super.key});

  final int veces;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    if (veces == 0 || reducirMovimiento(context)) return child;
    return TweenAnimationBuilder<double>(
      key: ValueKey(veces),
      tween: Tween(begin: 0, end: 1),
      duration: const Duration(milliseconds: 300),
      curve: Curves.easeInOut,
      builder: (_, t, hijo) => Transform.translate(
        offset: Offset(4 * math.sin(t * math.pi * 4) * (1 - t), 0),
        child: hijo,
      ),
      child: child,
    );
  }
}

/// La marca de la racha. No es una llama ni un emoji: es el trazo que sube
/// del logo, en celeste. Si
/// [encender], se dibuja de gris a celeste (400 ms, una vez); con movimiento
/// reducido aparece completo. Crece con la letra.
class MarcaRacha extends StatelessWidget {
  const MarcaRacha({super.key, this.encender = false});

  final bool encender;

  @override
  Widget build(BuildContext context) {
    final ancho = MediaQuery.textScalerOf(context).scale(22);
    if (!encender || sinAnimarMomentos(context)) {
      return Trazo(ancho: ancho);
    }
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: 1),
      duration: TemaSuperaPaes.movimientoLento,
      curve: TemaSuperaPaes.curvaEnfasis,
      builder: (_, t, _) => Trazo(
        ancho: ancho,
        avance: t,
        color: Color.lerp(
          TemaSuperaPaes.bordeInput,
          TemaSuperaPaes.logoCeleste,
          t,
        )!,
      ),
    );
  }
}

/// Texto o bloque que cambia con un fundido de 200 ms (resumen de
/// Practicar, precio de Planes). Con movimiento reducido el fundido queda en
/// 150 ms, porque confirma lo que el estudiante eligió.
class Cambiante extends StatelessWidget {
  const Cambiante({required this.clave, required this.child, super.key});

  final Object clave;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final reducir = reducirMovimiento(context);
    return AnimatedSwitcher(
      duration: duracion(
        context,
        TemaSuperaPaes.movimientoNormal,
        conservarFundido: true,
      ),
      switchInCurve: TemaSuperaPaes.curvaEntrada,
      switchOutCurve: TemaSuperaPaes.curvaSalida,
      layoutBuilder: (actual, previos) =>
          Stack(alignment: Alignment.topLeft, children: [...previos, ?actual]),
      transitionBuilder: (hijo, anim) => FadeTransition(
        opacity: anim,
        child: reducir
            ? hijo
            : SlideTransition(
                position: Tween(
                  begin: const Offset(0, 0.15),
                  end: Offset.zero,
                ).animate(anim),
                child: hijo,
              ),
      ),
      child: KeyedSubtree(key: ValueKey(clave), child: child),
    );
  }
}
