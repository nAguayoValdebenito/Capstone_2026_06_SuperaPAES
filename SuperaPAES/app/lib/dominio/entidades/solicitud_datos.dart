/// Un derecho de la Ley 21.719 que el estudiante puede pedir (A40, HU-09),
/// con la explicación que entrega la API.
class TipoDerecho {
  const TipoDerecho({
    required this.codigo,
    required this.nombre,
    required this.descripcion,
  });

  final String codigo;
  final String nombre;
  final String descripcion;
}

/// Estado de una solicitud (`contenido.estado_solicitud`).
enum EstadoSolicitud { pendiente, respondida, rechazada }

/// Una solicitud del estudiante, con su estado y, si ya la tiene, la
/// respuesta (HU-09 esc. 2).
class SolicitudDatos {
  const SolicitudDatos({
    required this.id,
    required this.tipo,
    required this.estado,
    required this.nombreEstado,
    required this.solicitadoEn,
    required this.venceEn,
    this.detalle,
    this.respondidoEn,
    this.respuesta,
  });

  final String id;

  /// Nombre del derecho, como «Acceso».
  final String tipo;
  final EstadoSolicitud estado;
  final String nombreEstado;
  final DateTime solicitadoEn;

  /// Fecha límite para responder, fijada al recibirla.
  final DateTime venceEn;
  final String? detalle;
  final DateTime? respondidoEn;
  final String? respuesta;
}
