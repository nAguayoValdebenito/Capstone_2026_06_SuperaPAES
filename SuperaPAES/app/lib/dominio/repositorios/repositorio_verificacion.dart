/// Respuesta de reenviar el correo de verificación. `enviado` es `false` si
/// el correo ya estaba verificado (`yaVerificado`) o si el envío falló.
typedef ResultadoReenvio = ({bool enviado, bool yaVerificado});

/// Contrato de la verificación del correo del estudiante de la sesión
/// (HU-05, CU-02, RN-32). Las dos rutas exigen la sesión de la app.
abstract interface class RepositorioVerificacion {
  /// Verifica el correo con el código de 6 dígitos. Si termina sin error, el
  /// correo quedó verificado (o ya lo estaba). Un código incorrecto, agotado
  /// o vencido llega como `ErrorApi`.
  Future<void> verificarCodigo(String codigo);

  /// Envía un correo nuevo; el enlace y el código anteriores dejan de servir.
  Future<ResultadoReenvio> reenviar();
}
