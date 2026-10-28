import 'package:supera_paes/dominio/entidades/cupo_de_hoy.dart';
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

/// Repositorio del cupo sin red: responde [cupo] o, si no es `null`,
/// [error]. Cuenta las consultas para comprobar cuándo se relee.
class RepositorioCupoFalso implements RepositorioCupo {
  RepositorioCupoFalso({CupoDeHoy? cupo}) : cupo = cupo ?? cupoDeEjemplo;

  CupoDeHoy cupo;
  ErrorApi? error;
  int consultas = 0;

  @override
  Future<CupoDeHoy> cupoDeHoy() async {
    consultas++;
    if (error case final fallo?) throw fallo;
    return cupo;
  }
}
