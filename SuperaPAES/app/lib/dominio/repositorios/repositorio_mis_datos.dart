import 'package:supera_paes/dominio/entidades/archivo_mis_datos.dart';
import 'package:supera_paes/dominio/entidades/solicitud_datos.dart';
import 'package:supera_paes/dominio/entidades/suscripcion_vigente.dart';

/// Contrato de los datos personales del estudiante de la sesión (HU-07,
/// HU-08 y HU-09). Las rutas exigen la sesión de la app; los errores llegan
/// como `ErrorApi`.
abstract interface class RepositorioMisDatos {
  /// Todos sus datos, como los guarda el servidor.
  Future<ArchivoMisDatos> descargar();

  /// Los términos aceptados (A39) y la suscripción que la tienda sigue
  /// cobrando (HU-08.2): con ella, A42b avisa antes de borrar (RN-34).
  Future<EstadoDeLaCuenta> estadoDeLaCuenta();

  /// Borra la cuenta (HU-08.1). La API cierra la sesión: después, solo queda
  /// olvidarla en el teléfono.
  Future<void> borrarCuenta();

  /// Los derechos de la Ley 21.719 que se pueden pedir (A40).
  Future<List<TipoDerecho>> tiposDerecho();

  /// Sus solicitudes, de la más nueva a la más antigua (HU-09 esc. 2).
  Future<List<SolicitudDatos>> solicitudes();

  /// Envía una solicitud (HU-09 esc. 1). Termina solo si el servidor la
  /// guardó; trae la fecha límite para responder.
  Future<SolicitudDatos> crearSolicitud(String tipo, String? detalle);
}
