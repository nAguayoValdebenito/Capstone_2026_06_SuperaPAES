import 'package:dio/dio.dart';
import 'package:supera_paes/datos/modelos/mis_datos_modelo.dart';
import 'package:supera_paes/dominio/entidades/archivo_mis_datos.dart';
import 'package:supera_paes/dominio/entidades/suscripcion_vigente.dart';
import 'package:supera_paes/nucleo/respuesta_api.dart';

/// Llama a /api/v1/app/privacidad (HU-07.1 y HU-08). Recibe el cliente con
/// sesión, que agrega el token de acceso y lo renueva si venció.
class FuenteMisDatosRemota {
  const FuenteMisDatosRemota(this._dio);

  final Dio _dio;

  Future<ArchivoMisDatos> descargar() async => MisDatosModelo.archivo(
    await pedirObjeto(
      _dio,
      'GET',
      '/privacidad/mis-datos',
      sinData: 'No recibimos tus datos. Inténtalo de nuevo.',
    ),
  );

  Future<EstadoDeLaCuenta> estadoDeLaCuenta() async =>
      MisDatosModelo.estadoDeLaCuenta(
        await pedirObjeto(
          _dio,
          'GET',
          '/privacidad/cuenta',
          sinData: 'No recibimos el estado de tu cuenta. Inténtalo de nuevo.',
        ),
      );

  Future<void> borrarCuenta() => pedirObjeto(
    _dio,
    'DELETE',
    '/privacidad/cuenta',
    sinData: 'No pudimos confirmar el borrado. Inténtalo de nuevo.',
  );
}
