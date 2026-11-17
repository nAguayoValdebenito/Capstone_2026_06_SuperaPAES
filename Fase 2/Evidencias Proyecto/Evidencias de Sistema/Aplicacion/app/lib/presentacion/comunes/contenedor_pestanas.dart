import 'package:flutter/widgets.dart';

import 'package:supera_paes/nucleo/tema.dart';
import 'package:supera_paes/presentacion/comunes/movimiento.dart';

/// Conserva montados los cinco navegadores. Solo las ramas del fundido se
/// pintan; las demás no reciben foco, toques, semántica ni ticks.
class ContenedorPestanas extends StatefulWidget {
  const ContenedorPestanas({
    required this.seleccionada,
    required this.hijos,
    super.key,
  });
  final int seleccionada;
  final List<Widget> hijos;

  @override
  State<ContenedorPestanas> createState() => _ContenedorPestanasState();
}

class _ContenedorPestanasState extends State<ContenedorPestanas> {
  final Set<int> _saliendo = {};

  @override
  void didUpdateWidget(ContenedorPestanas oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.seleccionada != oldWidget.seleccionada) {
      _saliendo.add(oldWidget.seleccionada);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (reducirMovimiento(context)) _saliendo.clear();
    return Stack(
      fit: StackFit.expand,
      children: [
        for (var indice = 0; indice < widget.hijos.length; indice++)
          _rama(context, indice),
      ],
    );
  }

  Widget _rama(BuildContext context, int indice) {
    final activa = indice == widget.seleccionada;
    return Offstage(
      key: ValueKey('rama-$indice'),
      offstage: !activa && !_saliendo.contains(indice),
      child: IgnorePointer(
        ignoring: !activa,
        child: ExcludeFocus(
          excluding: !activa,
          child: ExcludeSemantics(
            excluding: !activa,
            child: AnimatedOpacity(
              opacity: activa ? 1 : 0,
              duration: duracion(context, TemaSuperaPaes.movimientoNormal),
              onEnd: () {
                if (indice != widget.seleccionada &&
                    _saliendo.contains(indice)) {
                  setState(() => _saliendo.remove(indice));
                }
              },
              child: TickerMode(enabled: activa, child: widget.hijos[indice]),
            ),
          ),
        ),
      ),
    );
  }
}
