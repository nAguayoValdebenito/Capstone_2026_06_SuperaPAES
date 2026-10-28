import 'package:dio/dio.dart';
import 'package:supera_paes/datos/modelos/progreso_modelo.dart';
import 'package:supera_paes/dominio/entidades/progreso.dart';
import 'package:supera_paes/nucleo/respuesta_api.dart';

/// Llama a /api/v1/app/evaluaciones/progreso (HU-38.2). Recibe el cliente con
/// sesión, que agrega el token de acceso y lo renueva si venció.
class FuenteProgresoRemota {
  const FuenteProgresoRemota(this._dio);

  final Dio _dio;

  Future<ProgresoEstudiante> obtener() async => ProgresoModelo.progreso(
    await pedirObjeto(
      _dio,
      'GET',
      '/evaluaciones/progreso',
      sinData: 'La API respondió sin el progreso.',
    ),
  );
}
