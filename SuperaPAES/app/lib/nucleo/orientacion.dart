import 'dart:ui';

import 'package:flutter/services.dart';

import 'package:supera_paes/nucleo/tema.dart';

/// Fija la vertical en los teléfonos (lado corto menor a 600 dp), en Android
/// y en iPhone; la tablet queda libre. Todos los bocetos son verticales
/// (390 × 844) y la horizontal no está diseñada (plan de mejora visual del
/// 02/11). En iPhone lo fija también `Info.plist`.
Future<void> fijarVerticalEnTelefonos() async {
  final pantalla = PlatformDispatcher.instance.displays.firstOrNull;
  if (pantalla == null || pantalla.devicePixelRatio == 0) return;
  final ladoCorto = pantalla.size.shortestSide / pantalla.devicePixelRatio;
  if (ladoCorto >= TemaSuperaPaes.anchoTablet) return;
  await SystemChrome.setPreferredOrientations([DeviceOrientation.portraitUp]);
}
