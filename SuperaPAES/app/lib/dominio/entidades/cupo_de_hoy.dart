/// Cupo del día, preguntas extra y racha que muestra el inicio (HU-35,
/// RF-A05, RN-01, RN-02).
class CupoDeHoy {
  const CupoDeHoy({
    required this.maximo,
    required this.usadas,
    required this.restantes,
    required this.saldoExtra,
    required this.reiniciaEn,
    required this.racha,
  });

  /// 10 sin verificar el correo y 20 con el correo verificado.
  final int maximo;
  final int usadas;
  final int restantes;

  /// Preguntas extra ganadas con invitaciones; se usan cuando se acaba el
  /// cupo del día.
  final int saldoExtra;

  /// Las 00:00 de Chile siguientes, cuando el cupo vuelve al máximo.
  final DateTime reiniciaEn;

  /// Días seguidos practicando. Mientras no responda hoy se cuenta la de
  /// ayer; si pasó un día completo sin responder, es 0.
  final int racha;

  /// Sin cupo del día ni preguntas extra (la suscripción se ve por prueba).
  bool get agotado => restantes <= 0 && saldoExtra <= 0;
}
