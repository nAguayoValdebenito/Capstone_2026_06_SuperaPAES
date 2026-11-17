import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:supera_paes/nucleo/tema.dart';
import 'package:supera_paes/presentacion/comunes/animados.dart';
import 'package:supera_paes/presentacion/comunes/movimiento.dart';

enum EstadoBoton { normal, cargando, exito, error }

/// El botón principal con estados. Cargando mantiene el azul con una
/// rueda blanca (no se apaga a gris); éxito muestra ✓ 600 ms; error sacude
/// 4 dp y deja el texto del error encima. Cambios con `AnimatedSwitcher`
/// (200 ms); con movimiento reducido, corte y sin sacudida.
class BotonPrincipal extends StatelessWidget {
  const BotonPrincipal({
    required this.texto,
    required this.onPressed,
    super.key,
    this.estado = EstadoBoton.normal,
    this.error,
    this.intentosFallidos = 0,
    this.icono,
    this.color = TemaSuperaPaes.primario,
  });

  final String texto;
  final VoidCallback? onPressed;
  final EstadoBoton estado;
  final String? error;
  final int intentosFallidos;
  final IconData? icono;

  /// El rojo de error en «Borrar mi cuenta» (A42).
  final Color color;

  @override
  Widget build(BuildContext context) {
    final d = duracion(context, TemaSuperaPaes.movimientoNormal);
    final contenido = switch (estado) {
      EstadoBoton.cargando => const SizedBox(
        key: ValueKey('cargando'),
        width: 22,
        height: 22,
        child: CircularProgressIndicator(
          strokeWidth: 2.5,
          color: TemaSuperaPaes.superficie,
        ),
      ),
      EstadoBoton.exito => const Icon(
        Icons.check_rounded,
        key: ValueKey('exito'),
        size: 26,
      ),
      _ => Row(
        key: const ValueKey('texto'),
        mainAxisSize: MainAxisSize.min,
        children: [
          Flexible(child: Text(texto, textAlign: TextAlign.center)),
          if (icono != null) ...[
            const SizedBox(width: TemaSuperaPaes.espacio8),
            Icon(icono, size: 20),
          ],
        ],
      ),
    };
    final ocupado =
        estado == EstadoBoton.cargando || estado == EstadoBoton.exito;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        if (error != null && estado == EstadoBoton.error) ...[
          Semantics(
            liveRegion: true,
            child: Text(
              error!,
              style: TemaSuperaPaes.pequeno.copyWith(
                color: TemaSuperaPaes.error,
              ),
              textAlign: TextAlign.center,
            ),
          ),
          const SizedBox(height: TemaSuperaPaes.espacio8),
        ],
        Sacudida(
          veces: intentosFallidos,
          child: Semantics(
            label: estado == EstadoBoton.cargando ? '$texto, enviando' : null,
            child: FilledButton(
              onPressed: onPressed == null
                  ? null
                  : () {
                      if (ocupado) return;
                      unawaited(HapticFeedback.lightImpact());
                      onPressed!();
                    },
              style: FilledButton.styleFrom(
                backgroundColor: estado == EstadoBoton.exito
                    ? TemaSuperaPaes.exito
                    : color,
              ),
              child: AnimatedSwitcher(
                duration: d,
                switchInCurve: TemaSuperaPaes.curvaEntrada,
                transitionBuilder: (hijo, a) => FadeTransition(
                  opacity: a,
                  child: ScaleTransition(
                    scale: Tween<double>(begin: 0.85, end: 1).animate(a),
                    child: hijo,
                  ),
                ),
                child: contenido,
              ),
            ),
          ),
        ),
      ],
    );
  }
}
