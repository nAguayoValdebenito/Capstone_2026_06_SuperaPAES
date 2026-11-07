import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import 'package:supera_paes/nucleo/tema.dart';
import 'package:supera_paes/presentacion/apertura/ambito_apertura.dart';
import 'package:supera_paes/presentacion/comunes/movimiento.dart';

CustomTransitionPage<void> paginaConMovimiento(
  BuildContext context,
  GoRouterState estado,
  Widget pantalla,
) => CustomTransitionPage<void>(
  key: estado.pageKey,
  name: estado.matchedLocation,
  child: pantalla,
  transitionDuration: AmbitoApertura.estaEnCurso(context)
      ? Duration.zero
      : duracion(
          context,
          TemaSuperaPaes.movimientoLento,
          conservarFundido: true,
        ),
  reverseTransitionDuration: AmbitoApertura.estaEnCurso(context)
      ? Duration.zero
      : duracion(
          context,
          TemaSuperaPaes.movimientoSalidaPantalla,
          conservarFundido: true,
        ),
  transitionsBuilder: transicionDePantalla,
);

/// 24 dp y fundido; al reducir movimiento solo queda el fundido de 150 ms.
/// En iPhone se conserva el detector nativo de volver desde el borde. Durante
/// ese gesto la transición nativa sigue el dedo; no se instala otro detector.
Widget transicionDePantalla(
  BuildContext context,
  Animation<double> animacion,
  Animation<double> secundaria,
  Widget pantalla,
) => AnimatedBuilder(
  animation: animacion,
  child: pantalla,
  builder: (context, child) {
    final reducida = reducirMovimiento(context);
    final ruta = ModalRoute.of(context);
    final ios = Theme.of(context).platform == TargetPlatform.iOS;
    final gesto =
        ios &&
        ruta is PageRoute<void> &&
        ruta.popGestureInProgress &&
        !reducida;
    final curva = animacion.status == AnimationStatus.reverse
        ? TemaSuperaPaes.curvaSalida
        : TemaSuperaPaes.curvaEntrada;
    final avance = curva.transform(animacion.value);
    final direccion = Directionality.of(context) == TextDirection.ltr ? 1 : -1;
    final contenido = Opacity(
      opacity: gesto ? 1 : avance,
      child: Transform.translate(
        key: const ValueKey('traslacion-pantalla'),
        offset: Offset(
          reducida || gesto
              ? 0
              : direccion *
                    TemaSuperaPaes.desplazamientoPantalla *
                    (1 - avance),
          0,
        ),
        child: child,
      ),
    );
    if (ios && ruta is PageRoute<void>) {
      return CupertinoRouteTransitionMixin.buildPageTransitions<void>(
        ruta,
        context,
        gesto ? animacion : const AlwaysStoppedAnimation<double>(1),
        gesto ? secundaria : const AlwaysStoppedAnimation<double>(0),
        contenido,
      );
    }
    return contenido;
  },
);
