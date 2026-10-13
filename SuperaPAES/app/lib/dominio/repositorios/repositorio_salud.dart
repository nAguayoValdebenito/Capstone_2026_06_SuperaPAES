import 'package:supera_paes/dominio/entidades/estado_salud.dart';

/// Contrato para consultar el estado de la API.
abstract interface class RepositorioSalud {
  Future<EstadoSalud> obtenerEstado();
}
