import 'package:supera_paes/dominio/entidades/documento_legal.dart';
import 'package:supera_paes/nucleo/ids.dart';

/// Elemento de `data` de GET /cuentas/documentos-legales/vigentes.
class DocumentoLegalModelo {
  const DocumentoLegalModelo({
    required this.id,
    required this.tipo,
    required this.nombre,
    required this.version,
    required this.texto,
    required this.vigenteDesde,
  });

  factory DocumentoLegalModelo.fromJson(Map<String, dynamic> json) {
    return DocumentoLegalModelo(
      id: leerId(json['id']),
      tipo: json['tipo'] as String,
      nombre: json['nombre'] as String,
      version: json['version'] as String,
      texto: json['texto'] as String,
      vigenteDesde: json['vigenteDesde'] as String,
    );
  }

  final int id;

  /// `terminos` o `privacidad`.
  final String tipo;
  final String nombre;
  final String version;
  final String texto;

  /// Fecha en ISO 8601.
  final String vigenteDesde;

  Map<String, dynamic> toJson() => {
    'id': id,
    'tipo': tipo,
    'nombre': nombre,
    'version': version,
    'texto': texto,
    'vigenteDesde': vigenteDesde,
  };

  /// `null` si el tipo no es uno de los que conoce la app.
  DocumentoLegal? aEntidad() {
    final tipoConocido = switch (tipo) {
      'terminos' => TipoDocumentoLegal.terminos,
      'privacidad' => TipoDocumentoLegal.privacidad,
      _ => null,
    };
    if (tipoConocido == null) return null;
    return DocumentoLegal(
      id: id,
      tipo: tipoConocido,
      nombre: nombre,
      version: version,
      texto: texto,
      vigenteDesde: DateTime.parse(vigenteDesde),
    );
  }
}
