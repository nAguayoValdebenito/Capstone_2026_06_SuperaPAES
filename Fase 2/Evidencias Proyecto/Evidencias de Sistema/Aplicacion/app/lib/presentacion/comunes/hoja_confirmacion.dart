import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:supera_paes/nucleo/tema.dart';
import 'package:supera_paes/presentacion/comunes/componentes.dart';

/// Abre la hoja que sube desde abajo (A18, A29, A41) sobre el teléfono
/// completo, barra inferior incluida (`useRootNavigator`), y devuelve lo que
/// la hoja entregue al cerrarse; `null` si se cierra sin elegir. El fondo, las
/// esquinas y el asa salen de `bottomSheetTheme`.
Future<T?> mostrarHoja<T>(
  BuildContext context,
  Widget hoja, {
  bool cerrarPorFuera = true,
  bool permitirArrastre = true,
}) => showModalBottomSheet<T>(
  context: context,
  useRootNavigator: true,
  isDismissible: cerrarPorFuera,
  enableDrag: permitirArrastre,
  isScrollControlled: true,
  barrierColor: TemaSuperaPaes.texto.withValues(alpha: 0.5),
  builder: (contexto) => hoja,
);

/// Como [mostrarHoja]: `true` si el estudiante confirma; cerrarla o
/// «cancelar» es `false`.
Future<bool> confirmarEnHoja(BuildContext context, Widget hoja) async =>
    await mostrarHoja<bool>(context, hoja) ?? false;

/// Hoja con un título, su contenido, el botón que confirma y el que vuelve
/// atrás. Con [confirmarEsPrincipal] en `false` (terminar una práctica), el
/// botón lleno es el que vuelve («Seguir practicando») y el que confirma va
/// con borde. [icono] va suelto sobre el título.
class HojaConfirmacion extends StatelessWidget {
  const HojaConfirmacion({
    required this.titulo,
    required this.contenido,
    required this.confirmar,
    required this.cancelar,
    super.key,
    this.confirmarEsPrincipal = true,
    this.icono,
  });

  final String titulo;
  final Widget contenido;
  final String confirmar;
  final String cancelar;
  final bool confirmarEsPrincipal;
  final IconData? icono;

  @override
  Widget build(BuildContext context) {
    final botonConfirmar = confirmarEsPrincipal
        ? FilledButton(
            onPressed: () {
              unawaited(HapticFeedback.lightImpact());
              Navigator.of(context).pop(true);
            },
            child: Text(confirmar),
          )
        : OutlinedButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: Text(confirmar),
          );
    final botonVolver = confirmarEsPrincipal
        ? BotonTexto(
            onPressed: () => Navigator.of(context).pop(false),
            child: Text(cancelar),
          )
        : FilledButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: Text(cancelar),
          );
    // Con letra grande, la hoja se desplaza en vez de cortarse (RNF-12).
    return SafeArea(
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(
          TemaSuperaPaes.margenPantalla,
          0,
          TemaSuperaPaes.margenPantalla,
          TemaSuperaPaes.margenPantalla,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (icono case final simbolo?) ...[
              IconoEnCirculo(icono: simbolo),
              const SizedBox(height: TemaSuperaPaes.espacio8),
            ],
            Semantics(
              header: true,
              child: Text(titulo, style: TemaSuperaPaes.numero),
            ),
            const SizedBox(height: 8),
            contenido,
            const SizedBox(height: 20),
            if (confirmarEsPrincipal) ...[
              botonConfirmar,
              const SizedBox(height: 8),
              botonVolver,
            ] else ...[
              botonVolver,
              const SizedBox(height: 12),
              botonConfirmar,
            ],
          ],
        ),
      ),
    );
  }
}
