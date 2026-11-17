/// El archivo de «Descargar mis datos» (HU-07, RF-A18): la cuenta, los
/// consentimientos, el perfil, las evaluaciones con sus respuestas y
/// resultados, y los puntajes, en JSON.
class ArchivoMisDatos {
  const ArchivoMisDatos({required this.nombre, required this.contenido});

  /// Por ejemplo `supera-paes-mis-datos-2026-10-29.json`.
  final String nombre;

  /// El JSON con sangría, para que se pueda leer al abrirlo.
  final String contenido;
}
