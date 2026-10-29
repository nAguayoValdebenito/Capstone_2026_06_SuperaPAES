import 'package:supera_paes/dominio/entidades/archivo_mis_datos.dart';
import 'package:supera_paes/dominio/repositorios/repositorio_mis_datos.dart';
import 'package:supera_paes/nucleo/errores.dart';

const ArchivoMisDatos archivoDePrueba = ArchivoMisDatos(
  nombre: 'supera-paes-mis-datos-2026-10-29.json',
  contenido: '{\n  "cuenta": {\n    "nombre": "Ana"\n  }\n}',
);

/// Repositorio de Mis datos sin red. Con [error], la descarga falla.
class RepositorioMisDatosFalso implements RepositorioMisDatos {
  ErrorApi? error;
  int descargas = 0;

  @override
  Future<ArchivoMisDatos> descargar() async {
    descargas++;
    if (error case final fallo?) throw fallo;
    return archivoDePrueba;
  }
}
