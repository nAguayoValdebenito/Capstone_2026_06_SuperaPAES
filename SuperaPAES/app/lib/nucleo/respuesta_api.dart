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
