import 'package:supera_paes/dominio/entidades/archivo_mis_datos.dart';
import 'package:supera_paes/dominio/entidades/documento_legal.dart';
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

/// Repositorio de Mis datos sin red. Con [error], la descarga falla; con
/// [errorEstado] o [errorBorrado], la consulta del estado de la cuenta o el
/// borrado. Sin [suscripcion], no hay una vigente (A42).
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

  @override
  Future<ArchivoMisDatos> descargar() async {
    descargas++;
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
  Future<void> borrarCuenta() async {
    if (errorBorrado case final fallo?) throw fallo;
    borrados++;
  }
}
