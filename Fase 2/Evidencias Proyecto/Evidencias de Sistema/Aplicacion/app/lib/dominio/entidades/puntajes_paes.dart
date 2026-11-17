/// Puntajes PAES reales que declara el estudiante y su permiso (HU-41,
/// RF-A17, RN-16). El permiso es opcional y aparte de los términos; sin él no
/// se guarda ningún puntaje.
class PuntajesPaes {
  const PuntajesPaes({required this.permiso, required this.puntajes});

  final PermisoPuntajes permiso;

  /// Del año de admisión más reciente al más antiguo; vacía sin el permiso.
  final List<PuntajePaes> puntajes;

  /// El puntaje más reciente de la prueba, o `null` si no lo cargó.
  PuntajePaes? dePrueba(int pruebaId) {
    for (final puntaje in puntajes) {
      if (puntaje.pruebaId == pruebaId) return puntaje;
    }
    return null;
  }
}

class PermisoPuntajes {
  const PermisoPuntajes({
    required this.documentoId,
    required this.version,
    required this.texto,
    required this.otorgado,
  });

  /// La versión vigente del permiso; se envía al darlo.
  final int documentoId;
  final String version;

  /// El permiso en Markdown, como los documentos legales.
  final String texto;
  final bool otorgado;
}

class PuntajePaes {
  const PuntajePaes({
    required this.id,
    required this.pruebaId,
    required this.anioAdmision,
    required this.puntaje,
  });

  final int id;
  final int pruebaId;
  final int anioAdmision;

  /// De 100 a 1.000.
  final int puntaje;
}

/// Lo que se carga en A41.
typedef DatosPuntaje = ({int pruebaId, int anioAdmision, int puntaje});
