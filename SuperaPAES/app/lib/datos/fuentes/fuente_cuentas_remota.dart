import 'package:dio/dio.dart';
import 'package:supera_paes/datos/modelos/documento_legal_modelo.dart';
import 'package:supera_paes/datos/modelos/sesion_estudiante_modelo.dart';
import 'package:supera_paes/dominio/entidades/datos_registro.dart';
import 'package:supera_paes/nucleo/errores.dart';
import 'package:supera_paes/nucleo/respuesta_api.dart';

/// Llama a las rutas públicas de /api/v1/app/cuentas.
class FuenteCuentasRemota {
  const FuenteCuentasRemota(this._dio);

  final Dio _dio;

  Future<List<DocumentoLegalModelo>> documentosVigentes() async {
    try {
      final respuesta = await _dio.get<Object?>(
        '/cuentas/documentos-legales/vigentes',
      );
      final data = leerData(respuesta.data, estadoHttp: respuesta.statusCode);
      if (data is! List<dynamic>) {
        throw const ErrorApi(
          codigo: 'RESPUESTA_INVALIDA',
          mensaje: 'La API respondió sin los documentos legales.',
        );
      }
      return [
        for (final documento in data.whereType<Map<String, dynamic>>())
          DocumentoLegalModelo.fromJson(documento),
      ];
    } on DioException catch (excepcion) {
      throw ErrorApi.desdeDio(excepcion);
    }
  }

  Future<SesionEstudianteModelo> registrar(DatosRegistro datos) async {
    try {
      final respuesta = await _dio.post<Object?>(
        '/cuentas/registro',
        data: {
          'nombre': datos.nombre,
          'correo': datos.correo,
          'contrasena': datos.contrasena,
          // Aceptar los documentos vigentes incluye declarar la edad (RN-18).
          'declaraTenerCatorceAnios': true,
          'documentosAceptados': datos.documentosAceptados,
          'codigoInvitacion': ?datos.codigoInvitacion,
        },
      );
      final data = leerData(respuesta.data, estadoHttp: respuesta.statusCode);
      if (data is! Map<String, dynamic>) {
        throw const ErrorApi(
          codigo: 'RESPUESTA_INVALIDA',
          mensaje: 'La API respondió sin la cuenta creada.',
        );
      }
      return SesionEstudianteModelo.fromJson(data);
    } on DioException catch (excepcion) {
      throw ErrorApi.desdeDio(excepcion);
    }
  }
}
