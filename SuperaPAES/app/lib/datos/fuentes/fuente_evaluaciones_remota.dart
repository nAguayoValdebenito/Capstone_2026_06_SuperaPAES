import 'package:dio/dio.dart';
import 'package:supera_paes/datos/modelos/evaluacion_con_tiempo_modelo.dart';
import 'package:supera_paes/dominio/entidades/evaluacion_con_tiempo.dart';
import 'package:supera_paes/nucleo/respuesta_api.dart';

/// Llama a las evaluaciones con tiempo de /api/v1/app/evaluaciones (HU-36 y
/// HU-40). Recibe el cliente con sesión, que agrega el token de acceso y lo
/// renueva si venció.
class FuenteEvaluacionesRemota {
  const FuenteEvaluacionesRemota(this._dio);

  final Dio _dio;

  Future<DisponibilidadMiniEnsayo> disponibilidadMiniEnsayo(
    int pruebaId,
  ) async => EvaluacionConTiempoModelo.disponibilidadMini(
    await pedirObjeto(
      _dio,
      'GET',
      '/evaluaciones/mini-ensayos/disponibilidad',
      consulta: {'pruebaId': pruebaId},
      sinData: 'La API respondió sin la disponibilidad del mini-ensayo.',
    ),
  );

  Future<DisponibilidadDiagnostico> disponibilidadDiagnostico(
    int pruebaId,
  ) async => EvaluacionConTiempoModelo.disponibilidadDiagnostico(
    await pedirObjeto(
      _dio,
      'GET',
      '/evaluaciones/diagnosticos/disponibilidad',
      consulta: {'pruebaId': pruebaId},
      sinData: 'La API respondió sin la disponibilidad del diagnóstico.',
    ),
  );

  Future<EvaluacionConTiempo> iniciarMiniEnsayo(int pruebaId) async =>
      EvaluacionConTiempoModelo.iniciada(
        await publicarObjeto(_dio, '/evaluaciones/mini-ensayos', {
          'pruebaId': pruebaId,
        }, sinData: 'La API respondió sin el mini-ensayo.'),
        tipoNombre: 'Mini-ensayo',
      );

  Future<EvaluacionConTiempo> iniciarDiagnostico(int pruebaId) async =>
      EvaluacionConTiempoModelo.iniciada(
        await publicarObjeto(_dio, '/evaluaciones/diagnosticos', {
          'pruebaId': pruebaId,
        }, sinData: 'La API respondió sin el diagnóstico.'),
        tipoNombre: 'Diagnóstico',
      );

  Future<void> guardarRespuesta(
    int evaluacionId,
    int itemId,
    int alternativaId,
  ) => publicarObjeto(
    _dio,
    '/evaluaciones/$evaluacionId/items/$itemId/respuesta',
    {'alternativaId': alternativaId},
    sinData: 'La API respondió sin guardar la respuesta.',
  );

  Future<EntregaEvaluacion> entregar(int evaluacionId) async =>
      EvaluacionConTiempoModelo.entrega(
        await publicarObjeto(
          _dio,
          '/evaluaciones/$evaluacionId/entregar',
          null,
          sinData: 'La API respondió sin la entrega.',
        ),
      );
}
