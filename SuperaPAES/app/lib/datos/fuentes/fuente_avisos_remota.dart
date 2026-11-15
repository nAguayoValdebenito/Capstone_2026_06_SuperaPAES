import 'package:dio/dio.dart';
import 'package:supera_paes/dominio/entidades/aviso_error.dart';
import 'package:supera_paes/nucleo/errores.dart';
import 'package:supera_paes/nucleo/respuesta_api.dart';

/// Llama a /api/v1/app/preguntas/avisos/motivos y a
/// /api/v1/app/evaluaciones/{id}/items/{item}/avisos (HU-37). Recibe el
/// cliente con sesión, que agrega el token de acceso y lo renueva si venció.
class FuenteAvisosRemota {
  const FuenteAvisosRemota(this._dio);

  final Dio _dio;

  static const String _sinMotivos =
      'No recibimos los motivos. Inténtalo de nuevo.';

  Future<List<MotivoAviso>> motivos() async {
    final data = await pedirDato(_dio, '/preguntas/avisos/motivos');
    if (data is! List<Object?>) {
      throw const ErrorApi(codigo: 'RESPUESTA_INVALIDA', mensaje: _sinMotivos);
    }
    return [
      for (final fila in data)
        if (fila case {
          'codigo': final String codigo,
          'nombre': final String nombre,
        })
          MotivoAviso(codigo: codigo, nombre: nombre)
        else
          throw const ErrorApi(
            codigo: 'RESPUESTA_INVALIDA',
            mensaje: _sinMotivos,
          ),
    ];
  }

  Future<AvisoEnviado> enviar(DatosAviso datos) async {
    final data = await publicarObjeto(
      _dio,
      '/evaluaciones/${datos.evaluacionId}/items/${datos.itemId}/avisos',
      {'motivo': datos.motivo, 'comentario': datos.comentario},
      sinData: 'No pudimos confirmar tu aviso. Inténtalo de nuevo.',
    );
    if (data case {
      'id': final String id,
      'motivo': {'nombre': final String motivo},
    }) {
      return AvisoEnviado(id: id, motivo: motivo);
    }
    throw const ErrorApi(
      codigo: 'RESPUESTA_INVALIDA',
      mensaje: 'No pudimos confirmar tu aviso. Inténtalo de nuevo.',
    );
  }
}
