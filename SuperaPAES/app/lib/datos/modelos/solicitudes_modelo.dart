import 'package:supera_paes/dominio/entidades/solicitud_datos.dart';
import 'package:supera_paes/nucleo/errores.dart';

/// Lee los tipos de derecho y las solicitudes de /api/v1/app/privacidad
/// (HU-09.1).
abstract final class SolicitudesModelo {
  static const String _sinDatos =
      'Recibimos una respuesta que no esperábamos. Inténtalo de nuevo.';

  static Never _invalida() =>
      throw const ErrorApi(codigo: 'RESPUESTA_INVALIDA', mensaje: _sinDatos);

  static List<Map<String, dynamic>> _filas(Object? data) => switch (data) {
    final List<Object?> lista => [
      for (final fila in lista)
        if (fila is Map<String, dynamic>) fila else _invalida(),
    ],
    _ => _invalida(),
  };

  static List<TipoDerecho> tipos(Object? data) => [
    for (final fila in _filas(data))
      if (fila case {
        'codigo': final String codigo,
        'nombre': final String nombre,
        'descripcion': final String descripcion,
      })
        TipoDerecho(codigo: codigo, nombre: nombre, descripcion: descripcion)
      else
        _invalida(),
  ];

  static List<SolicitudDatos> solicitudes(Object? data) => [
    for (final fila in _filas(data)) solicitud(fila),
  ];

  static DateTime? _fecha(Object? valor) => switch (valor) {
    final String texto => DateTime.tryParse(texto)?.toLocal(),
    _ => null,
  };

  static SolicitudDatos solicitud(Map<String, dynamic> json) {
    if (json case {
      'id': final String id,
      'tipo': {'nombre': final String tipo},
      'estado': {'codigo': final String estado, 'nombre': final String nombre},
    }) {
      final solicitadoEn = _fecha(json['solicitadoEn']);
      final venceEn = _fecha(json['venceEn']);
      if (solicitadoEn == null || venceEn == null) _invalida();
      return SolicitudDatos(
        id: id,
        tipo: tipo,
        estado: switch (estado) {
          'respondida' => EstadoSolicitud.respondida,
          'rechazada' => EstadoSolicitud.rechazada,
          _ => EstadoSolicitud.pendiente,
        },
        nombreEstado: nombre,
        solicitadoEn: solicitadoEn,
        venceEn: venceEn,
        detalle: json['detalle'] as String?,
        respondidoEn: _fecha(json['respondidoEn']),
        respuesta: json['respuesta'] as String?,
      );
    }
    _invalida();
  }
}
