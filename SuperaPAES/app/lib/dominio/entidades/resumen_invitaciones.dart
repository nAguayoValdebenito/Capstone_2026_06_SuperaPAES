/// Lo que el estudiante comparte para invitar y cómo le va (A38; HU-46,
/// RF-A12, RN-33).
class ResumenInvitaciones {
  const ResumenInvitaciones({
    required this.codigo,
    required this.link,
    required this.registrados,
    required this.verificados,
  });

  /// Su código propio de 6 caracteres, como K7P2QX.
  final String codigo;

  /// La página de invitación de la consola con su código (W01 y W02).
  final String link;

  /// Se registraron con su código.
  final int registrados;

  /// De esos, los que ya verificaron su correo.
  final int verificados;
}
