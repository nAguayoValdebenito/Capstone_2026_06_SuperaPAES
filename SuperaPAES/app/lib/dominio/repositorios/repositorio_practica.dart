import 'package:supera_paes/dominio/entidades/practica.dart';

/// Contrato de la práctica del estudiante de la sesión (HU-30, CU-06). Las
/// rutas exigen la sesión de la app; los errores llegan como `ErrorApi`.
abstract interface class RepositorioPractica {
  /// Dificultades y pruebas con sus ejes, los contenidos que se enseñan hasta
  /// `curso` (código como `3M`) y sus habilidades (A13 y A14).
  Future<OpcionesPractica> opciones(String curso);

  /// Inicia la práctica. Sin preguntas suficientes llega `ErrorApi`
  /// `SIN_PREGUNTAS_SUFICIENTES`; sin cupo, `CUPO_AGOTADO`.
  Future<PracticaIniciada> iniciar(DatosPractica datos);

  /// Cierra la práctica y devuelve su resumen (A21).
  Future<ResumenPractica> cerrar(int id);
}
