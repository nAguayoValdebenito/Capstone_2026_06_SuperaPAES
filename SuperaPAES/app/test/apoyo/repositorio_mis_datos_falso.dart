import 'package:supera_paes/dominio/entidades/archivo_mis_datos.dart';
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

/// Repositorio de Mis datos sin red. Con [error], la descarga falla; con
/// [errorSuscripcion] o [errorBorrado], la consulta de la suscripción o el
/// borrado. Sin [suscripcion], no hay una vigente (A42).
class RepositorioMisDatosFalso implements RepositorioMisDatos {
  RepositorioMisDatosFalso({this.suscripcion});

  SuscripcionVigente? suscripcion;
  ErrorApi? error;
  ErrorApi? errorSuscripcion;
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
  Future<SuscripcionVigente?> suscripcionVigente() async {
    if (errorSuscripcion case final fallo?) throw fallo;
    return suscripcion;
  }

  @override
  Future<void> borrarCuenta() async {
    if (errorBorrado case final fallo?) throw fallo;
    borrados++;
  }
}
