import 'dart:convert';

import 'package:supera_paes/dominio/entidades/archivo_mis_datos.dart';

/// Arma el archivo de /api/v1/app/privacidad/mis-datos
/// (docs/contratos/HU-07.md). El JSON va tal como lo respondió el servidor.
abstract final class MisDatosModelo {
  static const _sangria = JsonEncoder.withIndent('  ');

  static ArchivoMisDatos archivo(Map<String, dynamic> json) {
    // La fecha del teléfono en que se generó; sin `generadoEn`, la de hoy.
    final generado = switch (json['generadoEn']) {
      final String fecha => DateTime.tryParse(fecha)?.toLocal(),
      _ => null,
    };
    final fecha = (generado ?? DateTime.now()).toIso8601String().substring(
      0,
      10,
    );
    return ArchivoMisDatos(
      nombre: 'supera-paes-mis-datos-$fecha.json',
      contenido: _sangria.convert(json),
    );
  }
}
