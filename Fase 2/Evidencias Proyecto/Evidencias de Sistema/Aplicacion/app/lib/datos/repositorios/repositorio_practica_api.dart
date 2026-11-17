import 'package:supera_paes/datos/fuentes/fuente_practica_remota.dart';
import 'package:supera_paes/dominio/entidades/evaluacion_abierta.dart';
import 'package:supera_paes/dominio/entidades/por_repasar.dart';
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
  Future<PorRepasar> porRepasar() => _fuente.porRepasar();

  @override
  Future<PracticaIniciada> iniciarRepaso(int pruebaId, {int? ejeId}) =>
      _fuente.iniciarRepaso(pruebaId, ejeId: ejeId);

  @override
  Future<PreguntaDePractica> siguiente(int practicaId) =>
      _fuente.siguiente(practicaId);

  @override
  Future<Correccion> responder(int practicaId, int itemId, int alternativaId) =>
      _fuente.responder(practicaId, itemId, alternativaId);

  @override
  Future<ResumenPractica> cerrar(int id) => _fuente.cerrar(id);

  @override
  Future<ConsultaEvaluacionAbierta> evaluacionAbierta() =>
      _fuente.evaluacionAbierta();
}
