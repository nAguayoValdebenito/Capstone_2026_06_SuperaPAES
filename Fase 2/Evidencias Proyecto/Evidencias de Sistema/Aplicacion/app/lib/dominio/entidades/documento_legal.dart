/// Tipo de un documento legal obligatorio (RN-30).
enum TipoDocumentoLegal { terminos, privacidad }

/// Versión vigente de un documento legal: los términos y condiciones (A02)
/// o la política de privacidad (A02b).
class DocumentoLegal {
  const DocumentoLegal({
    required this.id,
    required this.tipo,
    required this.nombre,
    required this.version,
    required this.texto,
    required this.vigenteDesde,
  });

  final int id;
  final TipoDocumentoLegal tipo;
  final String nombre;

  /// mayor.menor, por ejemplo 1.0.
  final String version;

  /// Markdown sencillo: títulos (`#`, `##`), listas (`- `) y párrafos.
  final String texto;
  final DateTime vigenteDesde;
}
