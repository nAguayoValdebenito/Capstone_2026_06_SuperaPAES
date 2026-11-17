import 'package:supera_paes/datos/fuentes/fuente_cupo_remota.dart';
import 'package:supera_paes/dominio/entidades/cupo_de_hoy.dart';
import 'package:supera_paes/dominio/entidades/resumen_invitaciones.dart';
import 'package:supera_paes/dominio/repositorios/repositorio_cupo.dart';

/// Implementación de [RepositorioCupo] que consulta la API.
class RepositorioCupoApi implements RepositorioCupo {
  const RepositorioCupoApi(this._fuente);

  final FuenteCupoRemota _fuente;

  @override
  Future<CupoDeHoy> cupoDeHoy() => _fuente.cupoDeHoy();

  @override
  Future<ResumenInvitaciones> misInvitaciones() => _fuente.misInvitaciones();
}
