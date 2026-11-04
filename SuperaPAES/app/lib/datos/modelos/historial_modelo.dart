import 'package:supera_paes/dominio/entidades/historial.dart';
import 'package:supera_paes/dominio/entidades/perfil_estudiante.dart';
import 'package:supera_paes/nucleo/ids.dart';

/// Lee `GET /evaluaciones/historial` (HU-62.1): las filas en `data` y la
/// paginación en `meta`.
abstract final class HistorialModelo {
  static PaginaHistorial pagina(
    List<Object?> filas,
    Map<String, dynamic> meta,
  ) => PaginaHistorial(
    evaluaciones: [
      for (final fila in filas) _evaluacion(fila! as Map<String, dynamic>),
    ],
    pagina: meta['pagina'] as int,
    porPagina: meta['porPagina'] as int,
    total: meta['total'] as int,
  );

  static EvaluacionDelHistorial _evaluacion(Map<String, dynamic> json) {
    final prueba = json['prueba'] as Map<String, dynamic>;
    final alcance = json['alcance'] as Map<String, dynamic>;
    return EvaluacionDelHistorial(
      id: leerId(json['id']),
      tipoNombre: (json['tipo'] as Map<String, dynamic>)['nombre'] as String,
      prueba: nombreDePrueba(
        prueba['codigo'] as String,
        prueba['nombre'] as String,
      ),
      alcance: alcance['tipo'] == 'prueba' ? null : alcance['nombre'] as String,
      cerradaEn: DateTime.parse(json['cerradaEn'] as String).toLocal(),
      cantidad: json['cantidad'] as int,
      correctas: json['correctas'] as int,
      abandonada:
          (json['estado'] as Map<String, dynamic>)['codigo'] == 'abandonada',
      porcentaje: (json['porcentaje'] as num?)?.toDouble(),
      puntaje: json['puntaje'] as int?,
      recalculada: json['recalculadoEn'] != null,
    );
  }
}
