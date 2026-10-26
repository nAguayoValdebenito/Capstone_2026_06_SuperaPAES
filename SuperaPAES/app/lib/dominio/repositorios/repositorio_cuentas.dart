import 'package:supera_paes/dominio/entidades/datos_registro.dart';
import 'package:supera_paes/dominio/entidades/documento_legal.dart';
import 'package:supera_paes/dominio/entidades/sesion_estudiante.dart';

/// Contrato de la cuenta del estudiante (módulo cuentas de la API).
abstract interface class RepositorioCuentas {
  /// Versiones vigentes de los términos y la política de privacidad.
  Future<List<DocumentoLegal>> documentosVigentes();

  /// Crea la cuenta y devuelve la sesión abierta (HU-01).
  Future<SesionEstudiante> registrar(DatosRegistro datos);
}
