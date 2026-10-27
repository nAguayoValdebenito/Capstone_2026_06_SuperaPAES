import 'package:dio/dio.dart';
import 'package:supera_paes/nucleo/errores.dart';

/// Lee el formato único de la API:
/// `{ "data": ..., "error": ..., "meta": ... }`.
/// Devuelve `data` o lanza [ErrorApi] si la respuesta trae un error o no tiene
/// el formato.
Object? leerData(Object? cuerpo, {int? estadoHttp}) {
  if (cuerpo is! Map<String, dynamic> || !cuerpo.containsKey('data')) {
    throw ErrorApi(
      codigo: 'RESPUESTA_INVALIDA',
      mensaje: 'La API respondió con un formato inesperado.',
      estadoHttp: estadoHttp,
    );
  }
  final error = ErrorApi.desdeCuerpo(cuerpo, estadoHttp: estadoHttp);
  if (error != null) throw error;
  return cuerpo['data'];
}

/// POST a `ruta` cuya respuesta trae un objeto en `data`. Los errores de red
/// y de la API llegan como [ErrorApi]; `sinData` es el mensaje si `data` no
/// es un objeto.
Future<Map<String, dynamic>> publicarObjeto(
  Dio dio,
  String ruta,
  Map<String, Object?>? cuerpo, {
  required String sinData,
}) async {
  try {
    final respuesta = await dio.post<Object?>(ruta, data: cuerpo);
    final data = leerData(respuesta.data, estadoHttp: respuesta.statusCode);
    if (data is! Map<String, dynamic>) {
      throw ErrorApi(codigo: 'RESPUESTA_INVALIDA', mensaje: sinData);
    }
    return data;
  } on DioException catch (excepcion) {
    throw ErrorApi.desdeDio(excepcion);
  }
}
