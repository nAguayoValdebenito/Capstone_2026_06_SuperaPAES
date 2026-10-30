import 'package:dio/dio.dart';
import 'package:supera_paes/datos/modelos/resultado_modelo.dart';
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
          sinData: 'La API respondió sin el resultado.',
        ),
      );

  Future<List<PreguntaRevisada>> revision(int id) async =>
      ResultadoModelo.revision(
        await pedirObjeto(
          _dio,
          'GET',
          '/evaluaciones/$id/revision',
          sinData: 'La API respondió sin la revisión.',
        ),
      );
}
