import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:supera_paes/nucleo/espera_servidor.dart';
import 'package:supera_paes/nucleo/tema.dart';
import 'package:supera_paes/presentacion/comunes/componentes.dart';

/// Sobre todas las pantallas, avisa que el servidor está despertando (A-10).
/// Flota arriba para no mover la pantalla y deja pasar los toques.
class AvisoServidor extends ConsumerWidget {
  const AvisoServidor({required this.child, super.key});

  final Widget child;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Stack(
      fit: StackFit.expand,
      children: [
        child,
        if (ref.watch(esperaServidorProvider))
          const Positioned(top: 0, left: 0, right: 0, child: _Aviso()),
      ],
    );
  }
}

class _Aviso extends StatelessWidget {
  const _Aviso();

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      bottom: false,
      minimum: const EdgeInsets.all(TemaSuperaPaes.espacio12),
      child: Align(
        alignment: Alignment.topCenter,
        child: ConstrainedBox(
          constraints: const BoxConstraints(
            maxWidth: TemaSuperaPaes.anchoFormulario,
          ),
          child: IgnorePointer(
            child: Semantics(
              liveRegion: true,
              child: const Material(
                type: MaterialType.transparency,
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    boxShadow: TemaSuperaPaes.sombraSuave,
                  ),
                  child: Aviso(
                    tono: TonoAviso.primario,
                    texto:
                        'Estamos despertando el servidor. '
                        'Puede tardar cerca de un minuto.',
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
