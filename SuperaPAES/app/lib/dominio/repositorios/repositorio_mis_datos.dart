import 'package:supera_paes/dominio/entidades/archivo_mis_datos.dart';

/// Contrato de los datos personales del estudiante de la sesión (HU-07). La
/// ruta exige la sesión de la app; los errores llegan como `ErrorApi`.
abstract interface class RepositorioMisDatos {
  /// Todos sus datos, como los guarda el servidor.
  Future<ArchivoMisDatos> descargar();
}
