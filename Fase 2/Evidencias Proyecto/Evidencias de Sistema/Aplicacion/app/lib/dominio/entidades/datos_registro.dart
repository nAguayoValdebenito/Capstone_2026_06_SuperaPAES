/// Lo que el estudiante ingresa para crear su cuenta (CU-01).
class DatosRegistro {
  const DatosRegistro({
    required this.nombre,
    required this.correo,
    required this.contrasena,
    required this.documentosAceptados,
    this.codigoInvitacion,
  });

  final String nombre;
  final String correo;
  final String contrasena;

  /// Ids de las versiones vigentes aceptadas. Aceptarlas es también declarar
  /// tener 14 años o más (RN-18).
  final List<int> documentosAceptados;

  /// Código de invitación opcional (RN-33).
  final String? codigoInvitacion;
}
