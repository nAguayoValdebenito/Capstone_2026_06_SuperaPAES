/// Un motivo para avisar un error en una pregunta (A23, HU-37): viene de la
/// lista de opciones del servidor (`contenido.motivo_reporte`).
class MotivoAviso {
  const MotivoAviso({required this.codigo, required this.nombre});

  final String codigo;
  final String nombre;
}

/// El aviso que el servidor guardó, pendiente de revisión.
class AvisoEnviado {
  const AvisoEnviado({required this.id, required this.motivo});

  final String id;
  final String motivo;
}

/// Lo que envía el estudiante sobre un ítem que recibió. La versión de la
/// pregunta la toma el servidor del ítem.
class DatosAviso {
  const DatosAviso({
    required this.evaluacionId,
    required this.itemId,
    required this.motivo,
    required this.comentario,
  });

  final int evaluacionId;
  final int itemId;
  final String motivo;
  final String comentario;
}
