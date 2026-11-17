import 'package:supera_paes/dominio/entidades/aviso_error.dart';

/// Contrato de los avisos de error del estudiante (HU-37, A23). Las rutas
/// exigen la sesión de la app; los errores llegan como `ErrorApi`.
abstract interface class RepositorioAvisos {
  /// Los motivos activos de la lista, en su orden.
  Future<List<MotivoAviso>> motivos();

  /// Guarda el aviso. Termina solo si el servidor lo guardó.
  Future<AvisoEnviado> enviar(DatosAviso datos);
}
