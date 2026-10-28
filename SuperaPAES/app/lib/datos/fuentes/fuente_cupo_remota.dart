import 'package:dio/dio.dart';
import 'package:supera_paes/datos/modelos/cupo_modelo.dart';
import 'package:supera_paes/dominio/entidades/cupo_de_hoy.dart';
import 'package:supera_paes/nucleo/respuesta_api.dart';

/// Llama a /api/v1/app/cupo-invitaciones/cupo (HU-35.1). Recibe el cliente
/// con sesión, que agrega el token de acceso y lo renueva si venció.
class FuenteCupoRemota {
  const FuenteCupoRemota(this._dio);

  final Dio _dio;

  Future<CupoDeHoy> cupoDeHoy() async => CupoModelo.cupoDeHoy(
    await pedirObjeto(
      _dio,
      'GET',
      '/cupo-invitaciones/cupo',
      sinData: 'La API respondió sin el cupo del día.',
    ),
  );
}
