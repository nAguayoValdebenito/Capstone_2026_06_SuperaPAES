import 'package:dio/dio.dart';
import 'package:supera_paes/datos/modelos/puntajes_modelo.dart';
import 'package:supera_paes/dominio/entidades/puntajes_paes.dart';
import 'package:supera_paes/nucleo/respuesta_api.dart';

/// Llama a /api/v1/app/cuentas/puntajes (HU-41.1). Recibe el cliente con
/// sesión, que agrega el token de acceso y lo renueva si venció.
class FuentePuntajesRemota {
  const FuentePuntajesRemota(this._dio);

  final Dio _dio;

  static const _ruta = '/cuentas/puntajes';
  static const _sinPuntajes = 'La API respondió sin los puntajes.';

  Future<PuntajesPaes> _pedir(
    String metodo,
    String ruta, [
    Map<String, Object?>? cuerpo,
  ]) async => PuntajesModelo.puntajes(
    await pedirObjeto(
      _dio,
      metodo,
      ruta,
      cuerpo: cuerpo,
      sinData: _sinPuntajes,
    ),
  );

  Future<PuntajesPaes> obtener() => _pedir('GET', _ruta);

  Future<PuntajesPaes> otorgarPermiso(int documentoId) =>
      _pedir('POST', '$_ruta/permiso', {'documentoId': documentoId});

  Future<PuntajesPaes> retirarPermiso() => _pedir('DELETE', '$_ruta/permiso');

  Future<PuntajesPaes> guardar(DatosPuntaje datos) => _pedir('PUT', _ruta, {
    'pruebaId': datos.pruebaId,
    'anioAdmision': datos.anioAdmision,
    'puntaje': datos.puntaje,
  });

  Future<PuntajesPaes> borrar(int puntajeId) =>
      _pedir('DELETE', '$_ruta/$puntajeId');
}
