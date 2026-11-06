import 'package:flutter/widgets.dart';

import 'package:supera_paes/nucleo/tema.dart';

/// ¿Pide el teléfono reducir el movimiento? (Android: «Quitar animaciones»;
/// iPhone: «Reducir movimiento».)
bool reducirMovimiento(BuildContext context) =>
    MediaQuery.disableAnimationsOf(context);

/// Duración de una animación que respeta la opción del sistema de reducir el
/// movimiento: con ella activa devuelve cero (todo aparece sin moverse),
/// salvo los fundidos que confirman lo que el estudiante hizo, que con
/// [conservarFundido] quedan en `movimientoRapido` (150 ms).
Duration duracion(
  BuildContext context,
  Duration base, {
  bool conservarFundido = false,
}) {
  if (!reducirMovimiento(context)) return base;
  return conservarFundido ? TemaSuperaPaes.movimientoRapido : Duration.zero;
}

/// Si una animación de autor (trazo, anillo, conteo, destellos) debe
/// mostrarse ya terminada, en el primer cuadro.
bool sinAnimarMomentos(BuildContext context) => reducirMovimiento(context);
