import 'package:dio/dio.dart';
import 'package:supera_paes/datos/modelos/mis_datos_modelo.dart';
import 'package:supera_paes/datos/modelos/plan_modelo.dart';
import 'package:supera_paes/dominio/entidades/plan.dart';
import 'package:supera_paes/dominio/entidades/suscripcion_vigente.dart';
import 'package:supera_paes/nucleo/errores.dart';
import 'package:supera_paes/nucleo/respuesta_api.dart';

/// Llama a /api/v1/app/suscripciones/planes y /actual (HU-43 y HU-45.2).
/// Recibe el cliente con sesión, que agrega el token y lo renueva si venció.
class FuenteSuscripcionesRemota {
  const FuenteSuscripcionesRemota(this._dio);

  final Dio _dio;

  Future<List<PlanOfrecido>> planes() async {
    final datos = await pedirDato(_dio, '/suscripciones/planes');
    if (datos is! List<Object?>) {
      throw const ErrorApi(
        codigo: 'RESPUESTA_INVALIDA',
        mensaje: 'No recibimos los planes. Inténtalo de nuevo.',
      );
    }
    return PlanModelo.planes(datos);
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
}
