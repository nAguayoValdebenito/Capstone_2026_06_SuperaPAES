import 'package:supera_paes/dominio/entidades/datos_registro.dart';
import 'package:supera_paes/dominio/entidades/documento_legal.dart';
import 'package:supera_paes/dominio/entidades/sesion_estudiante.dart';

/// Contrato de la cuenta del estudiante (módulo cuentas de la API).
abstract interface class RepositorioCuentas {
  /// Versiones vigentes de los términos y la política de privacidad.
  Future<List<DocumentoLegal>> documentosVigentes();

  /// Crea la cuenta y devuelve la sesión abierta (HU-01).
  Future<SesionEstudiante> registrar(DatosRegistro datos);

  /// Inicia sesión (HU-02). `dispositivo` queda guardado en la sesión.
  Future<SesionEstudiante> ingresar({
    required String correo,
    required String contrasena,
    String? dispositivo,
  });

  /// Cambia el token de renovación por un par nuevo; el anterior deja de
  /// servir.
  Future<TokensSesion> renovar(String tokenRenovacion);

  /// Cierra la sesión del token. Termina bien aunque ya estuviera cerrada.
  Future<void> cerrar(String tokenRenovacion);

  /// Pide el enlace para crear una contraseña nueva (HU-06, CU-04). La API
  /// responde lo mismo exista o no la cuenta, así que termina sin error en
  /// los dos casos.
  Future<void> solicitarRecuperacion(String correo);
}
