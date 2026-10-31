import 'dart:convert';

import 'package:supera_paes/dominio/entidades/archivo_mis_datos.dart';
import 'package:supera_paes/dominio/entidades/documento_legal.dart';
import 'package:supera_paes/dominio/entidades/suscripcion_vigente.dart';
import 'package:supera_paes/nucleo/errores.dart';

/// Arma el archivo de /api/v1/app/privacidad/mis-datos
/// (docs/contratos/HU-07.md), con el JSON tal como lo respondió el servidor,
/// y lee los términos aceptados y la suscripción vigente de
/// /privacidad/cuenta (HU-08.md).
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

  /// `data` de GET /privacidad/cuenta. Un documento de un tipo que la app no
  /// conoce se omite.
  static EstadoDeLaCuenta estadoDeLaCuenta(Map<String, dynamic> json) =>
      EstadoDeLaCuenta(
        suscripcionVigente: suscripcion(json),
        documentosAceptados: [
          for (final valor
              in json['documentosAceptados'] as List<Object?>? ?? [])
            ?_documento(valor! as Map<String, dynamic>),
        ],
      );

  static DocumentoAceptado? _documento(Map<String, dynamic> json) {
    final tipo = switch (json['documento']) {
      'terminos' => TipoDocumentoLegal.terminos,
      'privacidad' => TipoDocumentoLegal.privacidad,
      _ => null,
    };
    if (tipo == null) return null;
    return DocumentoAceptado(
      tipo: tipo,
      version: json['version'] as String,
      aceptadoEn: DateTime.parse(json['aceptadoEn'] as String).toLocal(),
    );
  }

  /// `data.suscripcionVigente` de GET /privacidad/cuenta; `null` sin una.
  static SuscripcionVigente? suscripcion(Map<String, dynamic> json) {
    final datos = json['suscripcionVigente'] as Map<String, dynamic>?;
    if (datos == null) return null;
    return SuscripcionVigente(
      enMora: datos['estado'] == 'en_mora',
      plan: datos['plan'] as String,
      periodicidad: datos['periodicidad'] as String,
      tienda: switch (datos['tienda']) {
        'google_play' => Tienda.googlePlay,
        'app_store' => Tienda.appStore,
        _ => throw const ErrorApi(
          codigo: 'RESPUESTA_INVALIDA',
          mensaje: 'La API respondió con una tienda desconocida.',
        ),
      },
    );
  }
}
