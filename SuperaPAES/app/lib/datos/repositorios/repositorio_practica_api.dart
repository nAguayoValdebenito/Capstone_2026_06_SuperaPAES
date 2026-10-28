import 'package:supera_paes/datos/fuentes/fuente_practica_remota.dart';
import 'package:supera_paes/dominio/entidades/practica.dart';
import 'package:supera_paes/dominio/repositorios/repositorio_practica.dart';

/// Implementación de [RepositorioPractica] que consulta la API.
class RepositorioPracticaApi implements RepositorioPractica {
  const RepositorioPracticaApi(this._fuente);

  final FuentePracticaRemota _fuente;

  @override
  Future<OpcionesPractica> opciones(String curso) => _fuente.opciones(curso);

  @override
  Future<PracticaIniciada> iniciar(DatosPractica datos) =>
      _fuente.iniciar(datos);

  @override
  Future<ResumenPractica> cerrar(int id) => _fuente.cerrar(id);
}
