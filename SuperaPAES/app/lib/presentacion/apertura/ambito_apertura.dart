import 'package:flutter/widgets.dart';

/// Durante la apertura, el destino se prepara sin otra transición debajo
/// del fundido. Después se conservan los movimientos habituales de las rutas.
class AmbitoApertura extends InheritedWidget {
  const AmbitoApertura({
    required this.enCurso,
    required super.child,
    super.key,
  });

  final bool enCurso;

  static bool estaEnCurso(BuildContext context) =>
      context.dependOnInheritedWidgetOfExactType<AmbitoApertura>()?.enCurso ??
      false;

  @override
  bool updateShouldNotify(AmbitoApertura oldWidget) =>
      enCurso != oldWidget.enCurso;
}
