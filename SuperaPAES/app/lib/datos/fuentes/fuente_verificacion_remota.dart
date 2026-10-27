import 'package:dio/dio.dart';
import 'package:supera_paes/dominio/repositorios/repositorio_verificacion.dart';
import 'package:supera_paes/nucleo/respuesta_api.dart';

/// Llama a /api/v1/app/cuentas/verificacion. Recibe el cliente con sesión,
/// que agrega el token de acceso y lo renueva si venció.
class FuenteVerificacionRemota {
  const FuenteVerificacionRemota(this._dio);

  final Dio _dio;

  Future<void> verificarCodigo(String codigo) async {
    await publicarObjeto(_dio, '/cuentas/verificacion/codigo', {
      'codigo': codigo,
    }, sinData: 'La API respondió sin el resultado de la verificación.');
  }

  Future<ResultadoReenvio> reenviar() async {
    final data = await publicarObjeto(
      _dio,
      '/cuentas/verificacion/reenviar',
      null,
      sinData: 'La API respondió sin el resultado del reenvío.',
    );
    return (
      enviado: data['enviado'] as bool,
      yaVerificado: data['yaVerificado'] as bool,
    );
  }
}
