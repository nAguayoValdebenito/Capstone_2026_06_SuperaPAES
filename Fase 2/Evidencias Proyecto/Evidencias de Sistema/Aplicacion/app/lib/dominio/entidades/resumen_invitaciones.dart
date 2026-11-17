/// Lo que el estudiante comparte para invitar y lo que gana con eso (A38;
/// HU-46, HU-47, RF-A12, RN-03, RN-33).
class ResumenInvitaciones {
  const ResumenInvitaciones({
    required this.codigo,
    required this.link,
    required this.registrados,
    required this.verificados,
    required this.preguntasGanadas,
    required this.saldoExtra,
    required this.premiadasMes,
    required this.topeMes,
  });

  /// Su código propio de 6 caracteres, como K7P2QX.
  final String codigo;

  /// La página de invitación de la consola con su código (W01 y W02).
  final String link;

  /// Se registraron con su código.
  final int registrados;

  /// De esos, los que ya verificaron su correo.
  final int verificados;

  /// Preguntas extra ganadas invitando, desde siempre.
  final int preguntasGanadas;

  /// Las preguntas extra que le quedan: ganadas menos usadas.
  final int saldoExtra;

  /// Invitaciones premiadas este mes y el tope del mes (RN-03).
  final int premiadasMes;
  final int topeMes;
}
