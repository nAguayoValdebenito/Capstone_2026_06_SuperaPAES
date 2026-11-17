import 'package:supera_paes/datos/fuentes/fuente_avisos_remota.dart';
import 'package:supera_paes/dominio/entidades/aviso_error.dart';
import 'package:supera_paes/dominio/repositorios/repositorio_avisos.dart';

/// Implementación de [RepositorioAvisos] que consulta la API.
class RepositorioAvisosApi implements RepositorioAvisos {
  const RepositorioAvisosApi(this._fuente);

  final FuenteAvisosRemota _fuente;

  @override
  Future<List<MotivoAviso>> motivos() => _fuente.motivos();

  @override
  Future<AvisoEnviado> enviar(DatosAviso datos) => _fuente.enviar(datos);
}
