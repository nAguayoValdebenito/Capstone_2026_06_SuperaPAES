import 'package:supera_paes/dominio/entidades/archivo_mis_datos.dart';
import 'package:supera_paes/dominio/entidades/documento_legal.dart';
import 'package:supera_paes/dominio/entidades/solicitud_datos.dart';
import 'package:supera_paes/dominio/entidades/suscripcion_vigente.dart';
import 'package:supera_paes/dominio/repositorios/repositorio_mis_datos.dart';
import 'package:supera_paes/nucleo/errores.dart';

const ArchivoMisDatos archivoDePrueba = ArchivoMisDatos(
  nombre: 'supera-paes-mis-datos-2026-10-29.json',
  contenido: '{\n  "cuenta": {\n    "nombre": "Ana"\n  }\n}',
);

/// La suscripción del boceto A42b: Todas las pruebas, mensual, en Google
/// Play.
const SuscripcionVigente suscripcionDePrueba = SuscripcionVigente(
  enMora: false,
  plan: 'Todas las pruebas',
  periodicidad: 'mensual',
  tienda: Tienda.googlePlay,
);

/// Los términos y la privacidad 1.0, aceptados el 21/10/2026 al registrarse.
final List<DocumentoAceptado> documentosDePrueba = [
  for (final tipo in TipoDocumentoLegal.values)
    DocumentoAceptado(
      tipo: tipo,
      version: '1.0',
      aceptadoEn: DateTime(2026, 10, 21, 18),
    ),
];

/// Tres de los seis derechos de `contenido.tipo_derecho`.
const List<TipoDerecho> tiposDePrueba = [
  TipoDerecho(
    codigo: 'acceso',
    nombre: 'Acceso',
    descripcion:
        'Saber qué datos personales guarda el sistema y recibir una copia.',
  ),
  TipoDerecho(
    codigo: 'rectificacion',
    nombre: 'Rectificación',
    descripcion: 'Corregir datos inexactos o incompletos.',
  ),
  TipoDerecho(
    codigo: 'supresion',
    nombre: 'Supresión',
    descripcion: 'Eliminar la cuenta y sus datos personales.',
  ),
];

/// Repositorio de Mis datos sin red. Las solicitudes enviadas quedan en
/// [solicitudesGuardadas], pendientes y con 30 días de plazo; con
/// [errorSolicitud], el envío falla y con [errorSolicitudes], la lista. Con
/// [error], la descarga falla; con [errorEstado] o [errorBorrado], la
/// consulta del estado de la cuenta o el borrado. Sin [suscripcion], no hay
/// una vigente (A42).
class RepositorioMisDatosFalso implements RepositorioMisDatos {
  RepositorioMisDatosFalso({
    this.suscripcion,
    List<DocumentoAceptado>? documentos,
  }) : documentos = documentos ?? documentosDePrueba;

  SuscripcionVigente? suscripcion;
  List<DocumentoAceptado> documentos;
  ErrorApi? error;
  ErrorApi? errorEstado;
  ErrorApi? errorBorrado;
  int descargas = 0;
  int borrados = 0;
  ErrorApi? errorSolicitud;
  ErrorApi? errorSolicitudes;
  final List<SolicitudDatos> solicitudesGuardadas = [];
  final List<(String, String?)> enviadas = [];

  /// Contraseñas recibidas al descargar o al borrar, en orden.
  final List<String> contrasenas = [];

  @override
  Future<ArchivoMisDatos> descargar(String contrasena) async {
    descargas++;
    contrasenas.add(contrasena);
    if (error case final fallo?) throw fallo;
    return archivoDePrueba;
  }

  @override
  Future<EstadoDeLaCuenta> estadoDeLaCuenta() async {
    if (errorEstado case final fallo?) throw fallo;
    return EstadoDeLaCuenta(
      suscripcionVigente: suscripcion,
      documentosAceptados: documentos,
    );
  }

  @override
  Future<void> borrarCuenta(String contrasena) async {
    contrasenas.add(contrasena);
    if (errorBorrado case final fallo?) throw fallo;
    borrados++;
  }

  @override
  Future<List<TipoDerecho>> tiposDerecho() async => tiposDePrueba;

  @override
  Future<List<SolicitudDatos>> solicitudes() async {
    if (errorSolicitudes case final fallo?) throw fallo;
    return solicitudesGuardadas.reversed.toList();
  }

  @override
  Future<SolicitudDatos> crearSolicitud(String tipo, String? detalle) async {
    if (errorSolicitud case final fallo?) throw fallo;
    enviadas.add((tipo, detalle));
    final solicitadoEn = DateTime(2026, 11, 15, 10);
    final solicitud = SolicitudDatos(
      id: '${solicitudesGuardadas.length + 1}',
      tipo: tiposDePrueba.firstWhere((t) => t.codigo == tipo).nombre,
      estado: EstadoSolicitud.pendiente,
      nombreEstado: 'Pendiente',
      solicitadoEn: solicitadoEn,
      venceEn: solicitadoEn.add(const Duration(days: 30)),
      detalle: detalle,
    );
    solicitudesGuardadas.add(solicitud);
    return solicitud;
  }
}
