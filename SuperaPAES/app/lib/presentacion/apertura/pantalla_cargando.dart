import 'package:flutter/material.dart';
import 'package:supera_paes/nucleo/tema.dart';
import 'package:supera_paes/presentacion/comunes/movimiento.dart';
import 'package:supera_paes/presentacion/comunes/trazo.dart';

/// Conserva el símbolo en el centro de la ventana, como la apertura nativa.
/// La línea de espera se coloca debajo sin desplazar el libro y el birrete.
class PantallaCargando extends StatelessWidget {
  const PantallaCargando({super.key, this.avance = 1, this.esperando = false});

  final double avance;
  final bool esperando;

  @override
  Widget build(BuildContext context) => ColoredBox(
    color: TemaSuperaPaes.fondo,
    child: Stack(
      fit: StackFit.expand,
      children: [
        Center(child: SimboloLogo(avance: avance)),
        if (esperando)
          Center(
            child: Transform.translate(
              offset: const Offset(
                0,
                TemaSuperaPaes.altoSimboloApertura / 2 +
                    TemaSuperaPaes.espacio32,
              ),
              child: const SizedBox(
                width: TemaSuperaPaes.anchoSimboloApertura,
                child: _LineaEspera(),
              ),
            ),
          ),
      ],
    ),
  );
}

class _LineaEspera extends StatelessWidget {
  const _LineaEspera();

  @override
  Widget build(BuildContext context) => Semantics(
    key: const ValueKey('linea-espera-apertura'),
    label: 'Cargando tu sesión',
    liveRegion: true,
    child: ExcludeSemantics(
      child: reducirMovimiento(context)
          ? const SizedBox(
              height: TemaSuperaPaes.grosorLineaApertura,
              child: ColoredBox(color: TemaSuperaPaes.primario),
            )
          : const LinearProgressIndicator(
              minHeight: TemaSuperaPaes.grosorLineaApertura,
              color: TemaSuperaPaes.primario,
              backgroundColor: TemaSuperaPaes.primarioSuave,
            ),
    ),
  );
}
