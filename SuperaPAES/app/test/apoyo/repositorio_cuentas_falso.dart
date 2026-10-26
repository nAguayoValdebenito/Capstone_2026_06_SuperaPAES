import 'package:supera_paes/dominio/entidades/datos_registro.dart';
import 'package:supera_paes/dominio/entidades/documento_legal.dart';
import 'package:supera_paes/dominio/entidades/sesion_estudiante.dart';
import 'package:supera_paes/dominio/repositorios/repositorio_cuentas.dart';

/// Documentos vigentes de ejemplo, como los de la semilla 003.
final documentosDeEjemplo = [
  DocumentoLegal(
    id: 1,
    tipo: TipoDocumentoLegal.terminos,
    nombre: 'Términos y condiciones',
    version: '1.0',
    texto:
        '# Términos y condiciones\n\nVersión 1.0. Vigente desde 19/10/2026.'
        '\n\n## 1. Quiénes somos\n\nSupera PAES es un servicio.',
    vigenteDesde: DateTime.utc(2026, 10, 19, 3),
  ),
  DocumentoLegal(
    id: 2,
    tipo: TipoDocumentoLegal.privacidad,
    nombre: 'Política de privacidad',
    version: '1.0',
    texto:
        '# Política de privacidad\n\n## 2. Qué datos tratamos\n\n'
        '- Cuenta: nombre y correo.',
    vigenteDesde: DateTime.utc(2026, 10, 19, 3),
  ),
];

const sesionDeEjemplo = SesionEstudiante(
  tokenAcceso: 'acceso',
  tokenRenovacion: 'renovacion',
  estudiante: Estudiante(
    id: '15',
    nombre: 'Camila Rojas',
    correo: 'camila@ejemplo.cl',
    correoVerificado: false,
  ),
);

/// Repositorio de cuentas en memoria: guarda lo que recibe y responde lo que
/// se le indique.
class RepositorioCuentasFalso implements RepositorioCuentas {
  RepositorioCuentasFalso({this.errorAlRegistrar});

  /// Si no es `null`, `registrar` lo lanza.
  Exception? errorAlRegistrar;

  final List<DatosRegistro> registros = [];

  @override
  Future<List<DocumentoLegal>> documentosVigentes() async =>
      documentosDeEjemplo;

  @override
  Future<SesionEstudiante> registrar(DatosRegistro datos) async {
    registros.add(datos);
    if (errorAlRegistrar case final error?) throw error;
    return sesionDeEjemplo;
  }
}
