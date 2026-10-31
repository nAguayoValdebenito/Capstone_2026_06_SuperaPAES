import 'package:supera_paes/datos/fuentes/fuente_mis_datos_remota.dart';
import 'package:supera_paes/dominio/entidades/archivo_mis_datos.dart';
import 'package:supera_paes/dominio/entidades/suscripcion_vigente.dart';
import 'package:supera_paes/dominio/repositorios/repositorio_mis_datos.dart';

/// Implementación de [RepositorioMisDatos] que consulta la API.
class RepositorioMisDatosApi implements RepositorioMisDatos {
  const RepositorioMisDatosApi(this._fuente);

  final FuenteMisDatosRemota _fuente;

  @override
  Future<ArchivoMisDatos> descargar() => _fuente.descargar();

  @override
  Future<EstadoDeLaCuenta> estadoDeLaCuenta() => _fuente.estadoDeLaCuenta();

  @override
  Future<void> borrarCuenta() => _fuente.borrarCuenta();
}
