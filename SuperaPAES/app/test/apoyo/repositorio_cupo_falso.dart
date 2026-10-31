import 'package:supera_paes/dominio/entidades/cupo_de_hoy.dart';
import 'package:supera_paes/dominio/entidades/resumen_invitaciones.dart';
import 'package:supera_paes/dominio/repositorios/repositorio_cupo.dart';
import 'package:supera_paes/nucleo/errores.dart';

/// El cupo del boceto A12: 3 disponibles, 7 de 10 usadas, 5 extra y una
/// racha de 5 días.
final CupoDeHoy cupoDeEjemplo = CupoDeHoy(
  maximo: 10,
  usadas: 7,
  restantes: 3,
  saldoExtra: 5,
  reiniciaEn: DateTime.utc(2026, 10, 29, 3),
  racha: 5,
);

/// Las invitaciones del boceto A38: K7P2QX, 3 registrados, 1 verificado,
/// 5 preguntas ganadas y en el saldo, y 1 de 10 premiadas este mes.
const ResumenInvitaciones invitacionesDeEjemplo = ResumenInvitaciones(
  codigo: 'K7P2QX',
  link: 'https://consola.superapaes.cl/invitar/K7P2QX',
  registrados: 3,
  verificados: 1,
  preguntasGanadas: 5,
  saldoExtra: 5,
  premiadasMes: 1,
  topeMes: 10,
);

/// Repositorio del cupo sin red: responde [cupo] o, si no es `null`,
/// [error]. Cuenta las consultas para comprobar cuándo se relee. Las
/// invitaciones son [invitaciones], o fallan con [errorInvitaciones].
class RepositorioCupoFalso implements RepositorioCupo {
  RepositorioCupoFalso({CupoDeHoy? cupo}) : cupo = cupo ?? cupoDeEjemplo;

  CupoDeHoy cupo;
  ErrorApi? error;
  int consultas = 0;
  ResumenInvitaciones invitaciones = invitacionesDeEjemplo;
  ErrorApi? errorInvitaciones;

  @override
  Future<CupoDeHoy> cupoDeHoy() async {
    consultas++;
    if (error case final fallo?) throw fallo;
    return cupo;
  }

  @override
  Future<ResumenInvitaciones> misInvitaciones() async {
    if (errorInvitaciones case final fallo?) throw fallo;
    return invitaciones;
  }
}
