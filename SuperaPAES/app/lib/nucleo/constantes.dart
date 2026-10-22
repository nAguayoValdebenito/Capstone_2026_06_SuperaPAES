/// Rutas de navegación de la app.
abstract final class Rutas {
  // Acceso a la cuenta
  static const String ingreso = '/ingreso';
  static const String crearCuenta = '/crear-cuenta';
  static const String terminos = '/terminos';
  static const String privacidad = '/privacidad';
  static const String verificarCorreo = '/verificar-correo';

  // Pestañas de la barra inferior (DAS 7.4)
  static const String inicio = '/inicio';
  static const String practicar = '/practicar';
  static const String evaluaciones = '/evaluaciones';
  static const String progreso = '/progreso';
  static const String perfil = '/perfil';

  // Práctica
  static const String pregunta = '/pregunta';
  static const String correccion = '/correccion';
  static const String cupoAgotado = '/cupo-agotado';
  static const String repaso = '/repaso';

  // Desde Perfil
  static const String planes = '/planes';
  static const String invitaciones = '/invitaciones';
}

/// Textos de interfaz que se repiten en varias pantallas.
abstract final class Textos {
  static const String nombreApp = 'Supera PAES';
}
