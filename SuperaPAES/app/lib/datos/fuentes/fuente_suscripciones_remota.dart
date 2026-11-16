import 'package:dio/dio.dart';
import 'package:supera_paes/datos/modelos/mis_datos_modelo.dart';
import 'package:supera_paes/datos/modelos/plan_modelo.dart';
import 'package:supera_paes/dominio/entidades/plan.dart';
import 'package:supera_paes/dominio/entidades/suscripcion_vigente.dart';
import 'package:supera_paes/nucleo/errores.dart';
import 'package:supera_paes/nucleo/respuesta_api.dart';

/// Llama a /api/v1/app/suscripciones/planes, /actual y /simulada (HU-43,
/// HU-45.2 y el modo de pruebas). Recibe el cliente con sesión, que agrega el
/// token y lo renueva si venció.
class FuenteSuscripcionesRemota {
  const FuenteSuscripcionesRemota(this._dio);

  final Dio _dio;

  /// Los planes de `data` y, en `meta`, si el modo de pruebas está encendido
  /// (`meta.modoPruebas`); apagado, `meta` llega vacío.
  Future<OfertaDePlanes> oferta() async {
    final Response<Object?> respuesta;
    try {
      respuesta = await _dio.get<Object?>('/suscripciones/planes');
    } on DioException catch (excepcion) {
      throw ErrorApi.desdeDio(excepcion);
    }
    final datos = leerData(respuesta.data, estadoHttp: respuesta.statusCode);
    if (datos is! List<Object?>) {
      throw const ErrorApi(
        codigo: 'RESPUESTA_INVALIDA',
        mensaje: 'No recibimos los planes. Inténtalo de nuevo.',
      );
    }
    final meta = (respuesta.data! as Map<String, dynamic>)['meta'];
    return OfertaDePlanes(
      planes: PlanModelo.planes(datos),
      modoPruebas: meta is Map<String, dynamic> && meta['modoPruebas'] == true,
    );
  }

  /// `data: null` significa que no tiene una suscripción activa o en mora.
  Future<SuscripcionVigente?> actual() async {
    final datos = await pedirDato(_dio, '/suscripciones/actual');
    if (datos == null) return null;
    if (datos is! Map<String, dynamic>) {
      throw const ErrorApi(
        codigo: 'RESPUESTA_INVALIDA',
        mensaje: 'No recibimos tu suscripción. Inténtalo de nuevo.',
      );
    }
    return MisDatosModelo.suscripcionDesde(datos);
  }

  /// POST /suscripciones/simulada: la suscripción simulada del modo de
  /// pruebas. La app solo necesita saber que quedó creada.
  Future<void> activarSimulada({required int planId, int? pruebaId}) async {
    await publicarObjeto(_dio, '/suscripciones/simulada', {
      'planId': planId,
      'pruebaId': ?pruebaId,
    }, sinData: 'No recibimos la suscripción de prueba. Inténtalo de nuevo.');
  }
}
