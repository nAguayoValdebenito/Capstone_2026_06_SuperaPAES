/// Rutas de navegación de la app.
abstract final class Rutas {
  // Acceso a la cuenta
  static const String ingreso = '/ingreso';
  static const String crearCuenta = '/crear-cuenta';
  static const String terminos = '/terminos';
  static const String privacidad = '/privacidad';
  static const String verificarCorreo = '/verificar-correo';

  // Pestañas de la barra inferior
  static const String inicio = '/inicio';
  static const String practicar = '/practicar';
  static const String progreso = '/progreso';
  static const String planes = '/planes';

  // Práctica
  static const String pregunta = '/pregunta';
  static const String correccion = '/correccion';
  static const String cupoAgotado = '/cupo-agotado';
  static const String ensayos = '/ensayos';
  static const String repaso = '/repaso';

  // Cuenta
  static const String invitaciones = '/invitaciones';
  static const String cuenta = '/cuenta';
}

/// Textos de interfaz que se repiten en varias pantallas.
abstract final class Textos {
  static const String nombreApp = 'Supera PAES';
  static const String miCuenta = 'Mi cuenta';
}
