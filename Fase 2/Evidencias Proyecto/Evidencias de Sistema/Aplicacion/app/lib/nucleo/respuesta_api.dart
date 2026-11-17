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
      mensaje:
          'Recibimos una respuesta que no esperábamos. Inténtalo de nuevo.',
      estadoHttp: estadoHttp,
    );
  }
  final error = ErrorApi.desdeCuerpo(cuerpo, estadoHttp: estadoHttp);
  if (error != null) throw error;
  return cuerpo['data'];
}

/// GET a `ruta` que entrega lo que venga en `data`: una lista, un objeto o
/// `null`. Quien llama revisa la forma.
Future<Object?> pedirDato(Dio dio, String ruta) async {
  try {
    final respuesta = await dio.get<Object?>(ruta);
    return leerData(respuesta.data, estadoHttp: respuesta.statusCode);
  } on DioException catch (excepcion) {
    throw ErrorApi.desdeDio(excepcion);
  }
}

/// GET a `ruta` de un listado: la lista de `data` y la paginación de `meta`.
/// `sinData` es el mensaje si la respuesta no trae las dos.
Future<({List<Object?> filas, Map<String, dynamic> meta})> pedirPagina(
  Dio dio,
  String ruta, {
  required String sinData,
  Map<String, Object?>? consulta,
}) async {
  try {
    final respuesta = await dio.get<Object?>(ruta, queryParameters: consulta);
    final filas = leerData(respuesta.data, estadoHttp: respuesta.statusCode);
    final meta = (respuesta.data! as Map<String, dynamic>)['meta'];
    if (filas is! List<Object?> || meta is! Map<String, dynamic>) {
      throw ErrorApi(codigo: 'RESPUESTA_INVALIDA', mensaje: sinData);
    }
    return (filas: filas, meta: meta);
  } on DioException catch (excepcion) {
    throw ErrorApi.desdeDio(excepcion);
  }
}

/// POST a `ruta` cuya respuesta trae un objeto en `data`. Los errores de red
/// y de la API llegan como [ErrorApi]; `sinData` es el mensaje si `data` no
/// es un objeto.
Future<Map<String, dynamic>> publicarObjeto(
  Dio dio,
  String ruta,
  Map<String, Object?>? cuerpo, {
  required String sinData,
}) => pedirObjeto(dio, 'POST', ruta, cuerpo: cuerpo, sinData: sinData);

/// Como [publicarObjeto], con cualquier método (`GET`, `PUT`, `POST`...).
/// `consulta` va en la dirección (`?curso=3M`).
Future<Map<String, dynamic>> pedirObjeto(
  Dio dio,
  String metodo,
  String ruta, {
  required String sinData,
  Map<String, Object?>? cuerpo,
  Map<String, Object?>? consulta,
}) async {
  try {
    final respuesta = await dio.request<Object?>(
      ruta,
      data: cuerpo,
      queryParameters: consulta,
      options: Options(method: metodo),
    );
    final data = leerData(respuesta.data, estadoHttp: respuesta.statusCode);
    if (data is! Map<String, dynamic>) {
      throw ErrorApi(codigo: 'RESPUESTA_INVALIDA', mensaje: sinData);
    }
    return data;
  } on DioException catch (excepcion) {
    throw ErrorApi.desdeDio(excepcion);
  }
}
