import 'package:supera_paes/dominio/entidades/cupo_de_hoy.dart';

/// Lee el JSON de GET /cupo-invitaciones/cupo (docs/contratos/HU-35.md).
abstract final class CupoModelo {
  static CupoDeHoy cupoDeHoy(Map<String, dynamic> json) => CupoDeHoy(
    maximo: json['maximo'] as int,
    usadas: json['usadas'] as int,
    restantes: json['restantes'] as int,
    saldoExtra: json['saldoExtra'] as int,
    reiniciaEn: DateTime.parse(json['reiniciaEn'] as String),
    racha: json['racha'] as int,
  );
}
