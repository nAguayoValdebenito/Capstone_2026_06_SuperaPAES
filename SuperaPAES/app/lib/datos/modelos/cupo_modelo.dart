import 'package:supera_paes/dominio/entidades/cupo_de_hoy.dart';
import 'package:supera_paes/dominio/entidades/resumen_invitaciones.dart';

/// Lee el JSON de GET /cupo-invitaciones/cupo (docs/contratos/HU-35.md) y de
/// GET /cupo-invitaciones/invitaciones (HU-46.md y HU-47.md).
abstract final class CupoModelo {
  static CupoDeHoy cupoDeHoy(Map<String, dynamic> json) => CupoDeHoy(
    maximo: json['maximo'] as int,
    usadas: json['usadas'] as int,
    restantes: json['restantes'] as int,
    saldoExtra: json['saldoExtra'] as int,
    reiniciaEn: DateTime.parse(json['reiniciaEn'] as String),
    racha: json['racha'] as int,
  );

  static ResumenInvitaciones invitaciones(Map<String, dynamic> json) =>
      ResumenInvitaciones(
        codigo: json['codigo'] as String,
        link: json['link'] as String,
        registrados: json['registrados'] as int,
        verificados: json['verificados'] as int,
        preguntasGanadas: json['preguntasGanadas'] as int,
        saldoExtra: json['saldoExtra'] as int,
        premiadasMes: json['premiadasMes'] as int,
        topeMes: json['topeMes'] as int,
      );
}
