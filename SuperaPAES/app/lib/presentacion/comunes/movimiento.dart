import 'package:flutter/widgets.dart';

/// Duración de una animación que respeta la opción del sistema de reducir el
/// movimiento (Android: «Quitar animaciones»; iPhone: «Reducir movimiento»):
/// con ella activa, todo aparece sin moverse.
Duration duracion(BuildContext context, Duration base) =>
    MediaQuery.disableAnimationsOf(context) ? Duration.zero : base;
