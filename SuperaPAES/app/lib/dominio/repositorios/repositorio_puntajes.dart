import 'package:supera_paes/dominio/entidades/puntajes_paes.dart';

/// Puntajes PAES declarados (HU-41). Cada operación responde el permiso y
/// los puntajes como quedaron.
abstract interface class RepositorioPuntajes {
  Future<PuntajesPaes> obtener();

  /// Da el permiso de la versión que leyó el estudiante.
  Future<PuntajesPaes> otorgarPermiso(int documentoId);

  /// Retira el permiso; el servidor borra todos los puntajes (RN-16).
  Future<PuntajesPaes> retirarPermiso();

  /// Guarda el puntaje de una prueba y un año; si ya estaba, lo corrige.
  Future<PuntajesPaes> guardar(DatosPuntaje datos);

  Future<PuntajesPaes> borrar(int puntajeId);
}
