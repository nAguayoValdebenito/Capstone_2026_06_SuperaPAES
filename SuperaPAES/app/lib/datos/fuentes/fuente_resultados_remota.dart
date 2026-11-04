import 'package:dio/dio.dart';
import 'package:supera_paes/datos/modelos/historial_modelo.dart';
import 'package:supera_paes/datos/modelos/resultado_modelo.dart';
import 'package:supera_paes/dominio/entidades/historial.dart';
import 'package:supera_paes/dominio/entidades/resultado_evaluacion.dart';
import 'package:supera_paes/nucleo/respuesta_api.dart';

/// Llama a /api/v1/app/evaluaciones/:id/resultado y /revision (HU-61.1).
/// Recibe el cliente con sesión, que agrega el token de acceso y lo renueva
/// si venció.
class FuenteResultadosRemota {
  const FuenteResultadosRemota(this._dio);

  final Dio _dio;

  Future<ResultadoEvaluacion> resultado(int id) async =>
      ResultadoModelo.resultado(
        await pedirObjeto(
          _dio,
          'GET',
          '/evaluaciones/$id/resultado',
          sinData: 'No recibimos el resultado. Inténtalo de nuevo.',
        ),
      );

  Future<PaginaHistorial> historial(FiltrosHistorial filtros) async {
    final (:filas, :meta) = await pedirPagina(
      _dio,
      '/evaluaciones/historial',
      consulta: {
        'pruebaId': ?filtros.pruebaId,
        'tipo': ?filtros.tipo,
        'pagina': filtros.pagina,
      },
      sinData: 'No recibimos tu historial. Inténtalo de nuevo.',
    );
    return HistorialModelo.pagina(filas, meta);
  }

  Future<List<PreguntaRevisada>> revision(int id) async =>
      ResultadoModelo.revision(
        await pedirObjeto(
          _dio,
          'GET',
          '/evaluaciones/$id/revision',
          sinData: 'No recibimos la revisión. Inténtalo de nuevo.',
        ),
      );
}
