import 'package:dio/dio.dart';
import 'package:supera_paes/datos/modelos/documento_legal_modelo.dart';
import 'package:supera_paes/datos/modelos/sesion_estudiante_modelo.dart';
import 'package:supera_paes/dominio/entidades/datos_registro.dart';
import 'package:supera_paes/dominio/entidades/sesion_estudiante.dart';
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
    final data = await _publicar('/cuentas/registro', {
      'nombre': datos.nombre,
      'correo': datos.correo,
      'contrasena': datos.contrasena,
      // Aceptar los documentos vigentes incluye declarar la edad (RN-18).
      'declaraTenerCatorceAnios': true,
      'documentosAceptados': datos.documentosAceptados,
      'codigoInvitacion': ?datos.codigoInvitacion,
    }, sinData: 'La API respondió sin la cuenta creada.');
    return SesionEstudianteModelo.fromJson(data);
  }

  Future<SesionEstudianteModelo> ingresar({
    required String correo,
    required String contrasena,
    String? dispositivo,
  }) async {
    final data = await _publicar('/cuentas/ingreso', {
      'correo': correo,
      'contrasena': contrasena,
      'dispositivo': ?dispositivo,
    }, sinData: 'La API respondió sin la sesión.');
    return SesionEstudianteModelo.fromJson(data);
  }

  Future<TokensSesion> renovar(String tokenRenovacion) async {
    final data = await _publicar('/cuentas/renovar', {
      'tokenRenovacion': tokenRenovacion,
    }, sinData: 'La API respondió sin la sesión renovada.');
    return (
      tokenAcceso: data['tokenAcceso'] as String,
      tokenRenovacion: data['tokenRenovacion'] as String,
    );
  }

  Future<void> cerrar(String tokenRenovacion) async {
    await _publicar('/cuentas/cerrar', {
      'tokenRenovacion': tokenRenovacion,
    }, sinData: 'La API respondió sin confirmar el cierre.');
  }

  Future<Map<String, dynamic>> _publicar(
    String ruta,
    Map<String, Object?> cuerpo, {
    required String sinData,
  }) => publicarObjeto(_dio, ruta, cuerpo, sinData: sinData);
}
