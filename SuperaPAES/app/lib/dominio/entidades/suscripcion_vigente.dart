import 'package:supera_paes/dominio/entidades/documento_legal.dart';

/// Tienda en que se compró la suscripción: solo ella la puede cancelar
/// (RN-34).
enum Tienda {
  googlePlay('Google Play'),
  appStore('App Store');

  const Tienda(this.nombre);

  final String nombre;
}

/// La suscripción activa o en mora que la tienda sigue cobrando (RN-34): al
/// borrar la cuenta, A42b avisa que hay que cancelarla en la tienda.
class SuscripcionVigente {
  const SuscripcionVigente({
    required this.enMora,
    required this.plan,
    required this.periodicidad,
    required this.tienda,
  });

  /// `false` si está activa.
  final bool enMora;

  /// «Una prueba» o «Todas las pruebas».
  final String plan;

  /// `mensual` o `anual`.
  final String periodicidad;
  final Tienda tienda;
}

/// La versión vigente que el estudiante aceptó de los términos o de la
/// política de privacidad (CU-14 paso 2).
class DocumentoAceptado {
  const DocumentoAceptado({
    required this.tipo,
    required this.version,
    required this.aceptadoEn,
  });

  final TipoDocumentoLegal tipo;
  final String version;
  final DateTime aceptadoEn;
}

/// Lo que Mis datos (A39) y «Borrar mi cuenta» (A42 y A42b) muestran de la
/// cuenta: GET /privacidad/cuenta.
class EstadoDeLaCuenta {
  const EstadoDeLaCuenta({
    required this.suscripcionVigente,
    required this.documentosAceptados,
  });

  /// `null` si no tiene una activa o en mora (A42).
  final SuscripcionVigente? suscripcionVigente;

  /// Términos y privacidad, en ese orden; falta el que no aceptó.
  final List<DocumentoAceptado> documentosAceptados;
}
