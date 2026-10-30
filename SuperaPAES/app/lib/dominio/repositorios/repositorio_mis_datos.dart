import 'package:supera_paes/dominio/entidades/archivo_mis_datos.dart';
import 'package:supera_paes/dominio/entidades/suscripcion_vigente.dart';

/// Contrato de los datos personales del estudiante de la sesión (HU-07 y
/// HU-08). Las rutas exigen la sesión de la app; los errores llegan como
/// `ErrorApi`.
abstract interface class RepositorioMisDatos {
  /// Todos sus datos, como los guarda el servidor.
  Future<ArchivoMisDatos> descargar();

  /// La suscripción que la tienda sigue cobrando, o `null` si no tiene
  /// (HU-08.2): con ella, A42b avisa antes de borrar (RN-34).
  Future<SuscripcionVigente?> suscripcionVigente();

  /// Borra la cuenta (HU-08.1). La API cierra la sesión: después, solo queda
  /// olvidarla en el teléfono.
  Future<void> borrarCuenta();
}
