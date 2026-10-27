/// Validaciones del formulario Crear cuenta que la app puede hacer sola
/// (CU-01). Repiten las del servidor con sus mismos mensajes; la lista de
/// contraseñas comunes y el límite de 72 bytes los comprueba solo la API.
abstract final class ValidacionesRegistro {
  static const int largoMaximoNombre = 100;
  static const int largoMinimoContrasena = 8;
  static const int largoMaximoContrasena = 72;
  static const int largoCodigoInvitacion = 6;

  /// Requisitos de RN-31 que se muestran bajo el campo (A01).
  static const String requisitosContrasena =
      'De 8 a 72 caracteres. No uses una contraseña común, como 12345678, ni '
      'tu correo.';

  static final RegExp _correo = RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$');

  /// Letras mayúsculas sin I ni O y dígitos del 2 al 9 (RN-33).
  static final RegExp _codigo = RegExp(r'^[A-HJ-NP-Z2-9]{6}$');

  static String? nombre(String? valor) {
    final nombre = normalizarNombre(valor ?? '');
    if (nombre.isEmpty) return 'Ingresa tu nombre.';
    if (nombre.length > largoMaximoNombre) {
      return 'El nombre puede tener hasta $largoMaximoNombre caracteres.';
    }
    return null;
  }

  static String? correo(String? valor) {
    if (!_correo.hasMatch((valor ?? '').trim())) {
      return 'Ingresa un correo válido.';
    }
    return null;
  }

  /// RN-31: largo en caracteres (no en unidades UTF-16) y distinta del
  /// correo.
  static String? contrasena(String? valor, String correo) {
    final contrasena = valor ?? '';
    final largo = contrasena.runes.length;
    if (largo < largoMinimoContrasena) {
      return 'La contraseña debe tener al menos $largoMinimoContrasena '
          'caracteres.';
    }
    if (largo > largoMaximoContrasena) {
      return 'La contraseña puede tener hasta $largoMaximoContrasena '
          'caracteres.';
    }
    if (contrasena.trim().toLowerCase() == correo.trim().toLowerCase()) {
      return 'La contraseña no puede ser igual al correo.';
    }
    return null;
  }

  /// Opcional: vacío es válido.
  static String? codigoInvitacion(String? valor) {
    final codigo = normalizarCodigo(valor ?? '');
    if (codigo.isEmpty || _codigo.hasMatch(codigo)) return null;
    return 'El código de invitación tiene 6 letras o números.';
  }

  /// Sin espacios al inicio, al final ni repetidos, como lo guarda la API.
  static String normalizarNombre(String valor) =>
      valor.trim().replaceAll(RegExp(r'\s+'), ' ');

  static String normalizarCodigo(String valor) => valor.trim().toUpperCase();
}
