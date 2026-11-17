import 'dart:math' as math;

import 'package:flutter/material.dart';

import 'package:supera_paes/nucleo/tema.dart';
import 'package:supera_paes/presentacion/comunes/glifos.dart';
import 'package:supera_paes/presentacion/comunes/movimiento.dart';
import 'package:supera_paes/presentacion/comunes/secciones.dart';

/// Barra del teléfono: píldora que se traslada, glifo con pulso y etiquetas
/// siempre en una línea. La escala del sistema solo se limita aquí.
class BarraInferior extends StatefulWidget {
  const BarraInferior({
    required this.seleccionada,
    required this.alSeleccionar,
    super.key,
  });

  final int seleccionada;
  final ValueChanged<int> alSeleccionar;

  @override
  State<BarraInferior> createState() => _BarraInferiorState();
}

class _BarraInferiorState extends State<BarraInferior>
    with SingleTickerProviderStateMixin {
  late final AnimationController _pulso = AnimationController(vsync: this);

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _pulso.duration = duracion(context, TemaSuperaPaes.movimientoNormal);
    if (reducirMovimiento(context)) {
      _pulso.stop();
      if (_pulso.value != 1) _pulso.value = 1;
    }
  }

  @override
  void didUpdateWidget(BarraInferior oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.seleccionada != widget.seleccionada &&
        !reducirMovimiento(context)) {
      _pulso.forward(from: 0);
    }
  }

  @override
  void dispose() {
    _pulso.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Material(
    color: TemaSuperaPaes.superficie,
    child: DecoratedBox(
      decoration: const BoxDecoration(
        border: Border(top: BorderSide(color: TemaSuperaPaes.borde)),
      ),
      child: SafeArea(
        top: false,
        child: MediaQuery.withClampedTextScaling(
          maxScaleFactor: TemaSuperaPaes.escalaLetraBarra,
          child: SizedBox(
            height: TemaSuperaPaes.altoBarraNavegacion,
            child: LayoutBuilder(builder: _contenido),
          ),
        ),
      ),
    ),
  );

  Widget _contenido(BuildContext context, BoxConstraints medidas) {
    final ancho = medidas.maxWidth / pestanas.length;
    final indicador = math.min(
      TemaSuperaPaes.anchoIndicadorNavegacion,
      ancho - TemaSuperaPaes.espacio8,
    );
    final direccion = Directionality.of(context) == TextDirection.ltr ? 1 : -1;
    final figura = Container(
      width: indicador,
      height: TemaSuperaPaes.altoIndicadorNavegacion,
      decoration: BoxDecoration(
        color: TemaSuperaPaes.primarioSuave,
        borderRadius: BorderRadius.circular(
          TemaSuperaPaes.altoIndicadorNavegacion / 2,
        ),
      ),
    );
    Widget trasladar(double posicion, Widget? child) => Transform.translate(
      key: const ValueKey('indicador-pestana'),
      offset: Offset(direccion * posicion * ancho, 0),
      child: child,
    );
    return Stack(
      children: [
        PositionedDirectional(
          start: (ancho - indicador) / 2,
          top: TemaSuperaPaes.espacio8,
          child: reducirMovimiento(context)
              ? trasladar(widget.seleccionada.toDouble(), figura)
              : TweenAnimationBuilder<double>(
                  tween: Tween(
                    begin: widget.seleccionada.toDouble(),
                    end: widget.seleccionada.toDouble(),
                  ),
                  duration: duracion(context, TemaSuperaPaes.movimientoLento),
                  curve: TemaSuperaPaes.curvaEntrada,
                  builder: (context, posicion, child) =>
                      trasladar(posicion, child),
                  child: figura,
                ),
        ),
        Row(
          children: [
            for (var indice = 0; indice < pestanas.length; indice++)
              Expanded(child: _destino(indice)),
          ],
        ),
      ],
    );
  }

  Widget _destino(int indice) {
    final activa = indice == widget.seleccionada;
    final texto = pestanas[indice].etiquetaPestana ?? pestanas[indice].titulo;
    final color = activa
        ? TemaSuperaPaes.primario
        : TemaSuperaPaes.textoSecundario;
    return Semantics(
      key: ValueKey('pestana-$indice'),
      button: true,
      selected: activa,
      label: texto,
      onTap: () => widget.alSeleccionar(indice),
      child: ExcludeSemantics(
        child: InkWell(
          onTap: () => widget.alSeleccionar(indice),
          child: Padding(
            padding: const EdgeInsets.symmetric(
              horizontal: TemaSuperaPaes.espacio4,
              vertical: TemaSuperaPaes.espacio8,
            ),
            child: Column(
              children: [
                SizedBox(
                  height: TemaSuperaPaes.altoIndicadorNavegacion,
                  child: Center(
                    child: AnimatedBuilder(
                      animation: _pulso,
                      child: IconoPestana(indice, color: color, activa: activa),
                      builder: (context, child) => Transform.scale(
                        scale: activa && !reducirMovimiento(context)
                            ? 1 +
                                  (TemaSuperaPaes.escalaPulsoPestana - 1) *
                                      math.sin(math.pi * _pulso.value)
                            : 1,
                        child: child,
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: TemaSuperaPaes.espacio4),
                Expanded(
                  child: FittedBox(
                    fit: BoxFit.scaleDown,
                    child: Text(
                      texto,
                      maxLines: 1,
                      softWrap: false,
                      style: TemaSuperaPaes.mini.copyWith(color: color),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
