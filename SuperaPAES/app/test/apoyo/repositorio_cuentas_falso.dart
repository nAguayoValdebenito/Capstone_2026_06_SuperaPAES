import 'package:supera_paes/dominio/entidades/datos_registro.dart';
import 'package:supera_paes/dominio/entidades/documento_legal.dart';
import 'package:supera_paes/dominio/entidades/sesion_estudiante.dart';
import 'package:supera_paes/dominio/repositorios/almacen_sesion.dart';
import 'package:supera_paes/dominio/repositorios/repositorio_cuentas.dart';
import 'package:supera_paes/dominio/repositorios/repositorio_verificacion.dart';

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
    id: 15,
    nombre: 'Camila Rojas',
    correo: 'camila@ejemplo.cl',
    correoVerificado: false,
  ),
);

/// Datos de un ingreso recibido por el repositorio falso.
typedef Ingreso = ({String correo, String contrasena, String? dispositivo});

/// Repositorio de cuentas en memoria: guarda lo que recibe y responde lo que
/// se le indique.
class RepositorioCuentasFalso implements RepositorioCuentas {
  RepositorioCuentasFalso({this.errorAlRegistrar});

  /// Si no es `null`, `registrar` lo lanza.
  Exception? errorAlRegistrar;
  Exception? errorAlIngresar;
  Exception? errorAlRenovar;
  Exception? errorAlCerrar;

  final List<DatosRegistro> registros = [];
  final List<Ingreso> ingresos = [];
  final List<String> renovaciones = [];
  final List<String> cierres = [];

  @override
  Future<List<DocumentoLegal>> documentosVigentes() async =>
      documentosDeEjemplo;

  @override
  Future<SesionEstudiante> registrar(DatosRegistro datos) async {
    registros.add(datos);
    if (errorAlRegistrar case final error?) throw error;
    return sesionDeEjemplo;
  }

  @override
  Future<SesionEstudiante> ingresar({
    required String correo,
    required String contrasena,
    String? dispositivo,
  }) async {
    ingresos.add((
      correo: correo,
      contrasena: contrasena,
      dispositivo: dispositivo,
    ));
    if (errorAlIngresar case final error?) throw error;
    return sesionDeEjemplo;
  }

  /// Entrega `acceso-N` y `renovacion-N`, con N el número de renovación.
  @override
  Future<TokensSesion> renovar(String tokenRenovacion) async {
    renovaciones.add(tokenRenovacion);
    if (errorAlRenovar case final error?) throw error;
    final n = renovaciones.length;
    return (tokenAcceso: 'acceso-$n', tokenRenovacion: 'renovacion-$n');
  }

  @override
  Future<void> cerrar(String tokenRenovacion) async {
    cierres.add(tokenRenovacion);
    if (errorAlCerrar case final error?) throw error;
  }
}

/// Verificación del correo en memoria: guarda los códigos y los reenvíos, y
/// responde lo que se le indique.
class RepositorioVerificacionFalso implements RepositorioVerificacion {
  /// Errores que lanza `verificarCodigo`, uno por intento y en orden; sin
  /// errores pendientes, el código es correcto.
  final List<Exception> erroresAlVerificar = [];
  Exception? errorAlReenviar;
  ResultadoReenvio resultadoReenvio = (enviado: true, yaVerificado: false);

  final List<String> codigos = [];
  int reenvios = 0;

  @override
  Future<void> verificarCodigo(String codigo) async {
    codigos.add(codigo);
    if (erroresAlVerificar.isNotEmpty) throw erroresAlVerificar.removeAt(0);
  }

  @override
  Future<ResultadoReenvio> reenviar() async {
    reenvios++;
    if (errorAlReenviar case final error?) throw error;
    return resultadoReenvio;
  }
}

/// Almacén de la sesión en memoria, en lugar del cifrado del teléfono.
class AlmacenSesionEnMemoria implements AlmacenSesion {
  AlmacenSesionEnMemoria([this.guardada]);

  SesionEstudiante? guardada;

  @override
  Future<SesionEstudiante?> leer() async => guardada;

  @override
  Future<void> guardar(SesionEstudiante sesion) async => guardada = sesion;

  @override
  Future<void> borrar() async => guardada = null;
}
