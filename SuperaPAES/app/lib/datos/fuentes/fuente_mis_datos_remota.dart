import 'package:dio/dio.dart';
import 'package:supera_paes/datos/modelos/mis_datos_modelo.dart';
import 'package:supera_paes/datos/modelos/solicitudes_modelo.dart';
import 'package:supera_paes/dominio/entidades/archivo_mis_datos.dart';
import 'package:supera_paes/dominio/entidades/solicitud_datos.dart';
import 'package:supera_paes/dominio/entidades/suscripcion_vigente.dart';
import 'package:supera_paes/nucleo/interceptor_sesion.dart';
import 'package:supera_paes/nucleo/respuesta_api.dart';

/// Llama a /api/v1/app/privacidad (HU-07.1, HU-08 y HU-09.1). Recibe el cliente con
/// sesión, que agrega el token de acceso y lo renueva si venció.
class FuenteMisDatosRemota {
  const FuenteMisDatosRemota(this._dio);

  final Dio _dio;

  /// Descargar los datos y borrar la cuenta llevan la contraseña en el
  /// cuerpo; un 401 por la contraseña no renueva la sesión.
  static const Map<String, Object?> _conContrasena = {
    InterceptorSesion.confirmaContrasena: true,
  };

  /// POST porque la contraseña va en el cuerpo, nunca en la dirección.
  Future<ArchivoMisDatos> descargar(String contrasena) async =>
      MisDatosModelo.archivo(
        await pedirObjeto(
          _dio,
          'POST',
          '/privacidad/mis-datos',
          cuerpo: {'contrasena': contrasena},
          extra: _conContrasena,
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

  Future<void> borrarCuenta(String contrasena) => pedirObjeto(
    _dio,
    'DELETE',
    '/privacidad/cuenta',
    cuerpo: {'contrasena': contrasena},
    extra: _conContrasena,
    sinData: 'No pudimos confirmar el borrado. Inténtalo de nuevo.',
  );

  Future<List<TipoDerecho>> tiposDerecho() async => SolicitudesModelo.tipos(
    await pedirDato(_dio, '/privacidad/tipos-derecho'),
  );

  Future<List<SolicitudDatos>> solicitudes() async =>
      SolicitudesModelo.solicitudes(
        await pedirDato(_dio, '/privacidad/solicitudes'),
      );

  Future<SolicitudDatos> crearSolicitud(String tipo, String? detalle) async =>
      SolicitudesModelo.solicitud(
        await publicarObjeto(_dio, '/privacidad/solicitudes', {
          'tipo': tipo,
          'detalle': detalle,
        }, sinData: 'No pudimos confirmar tu solicitud. Inténtalo de nuevo.'),
      );
}
