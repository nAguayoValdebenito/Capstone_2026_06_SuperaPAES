import 'package:dio/dio.dart';
import 'package:supera_paes/datos/modelos/estado_salud_modelo.dart';
import 'package:supera_paes/nucleo/configuracion.dart';
import 'package:supera_paes/nucleo/errores.dart';
import 'package:supera_paes/nucleo/respuesta_api.dart';

/// Llama a GET /api/v1/salud y lee el formato `{ data, error, meta }`.
class FuenteSaludRemota {
  const FuenteSaludRemota(this._dio);

  final Dio _dio;

  Future<EstadoSaludModelo> obtener() async {
    try {
      final respuesta = await _dio.get<Object?>(Configuracion.urlSalud);
      final data = leerData(respuesta.data, estadoHttp: respuesta.statusCode);
      if (data is! Map<String, dynamic>) {
        throw const ErrorApi(
          codigo: 'RESPUESTA_INVALIDA',
          mensaje: 'La API respondió sin el estado del sistema.',
        );
      }
      return EstadoSaludModelo.fromJson(data);
    } on DioException catch (excepcion) {
      throw ErrorApi.desdeDio(excepcion);
    }
  }
}
