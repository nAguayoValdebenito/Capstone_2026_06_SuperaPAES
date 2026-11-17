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
      sinData:
          'No recibimos la disponibilidad del mini-ensayo. Inténtalo de nuevo.',
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
      sinData:
          'No recibimos la disponibilidad del diagnóstico. Inténtalo de nuevo.',
    ),
  );

  Future<EvaluacionConTiempo> iniciarMiniEnsayo(int pruebaId) async =>
      EvaluacionConTiempoModelo.iniciada(
        await publicarObjeto(_dio, '/evaluaciones/mini-ensayos', {
          'pruebaId': pruebaId,
        }, sinData: 'No recibimos el mini-ensayo. Inténtalo de nuevo.'),
        tipoNombre: 'Mini-ensayo',
      );

  Future<EvaluacionConTiempo> iniciarDiagnostico(int pruebaId) async =>
      EvaluacionConTiempoModelo.iniciada(
        await publicarObjeto(_dio, '/evaluaciones/diagnosticos', {
          'pruebaId': pruebaId,
        }, sinData: 'No recibimos el diagnóstico. Inténtalo de nuevo.'),
        tipoNombre: 'Diagnóstico',
      );

  Future<DisponibilidadEnsayo> disponibilidadEnsayo(int pruebaId) async =>
      EvaluacionConTiempoModelo.disponibilidadEnsayo(
        await pedirObjeto(
          _dio,
          'GET',
          '/evaluaciones/ensayos/disponibilidad',
          consulta: {'pruebaId': pruebaId},
          sinData:
              'No recibimos la disponibilidad del ensayo. Inténtalo de nuevo.',
        ),
      );

  Future<EvaluacionConTiempo> iniciarEnsayo(int pruebaId) async =>
      EvaluacionConTiempoModelo.iniciada(
        await publicarObjeto(_dio, '/evaluaciones/ensayos', {
          'pruebaId': pruebaId,
        }, sinData: 'No recibimos el ensayo. Inténtalo de nuevo.'),
        tipoNombre: 'Ensayo completo',
      );

  Future<void> guardarRespuesta(
    int evaluacionId,
    int itemId,
    int alternativaId,
  ) => publicarObjeto(
    _dio,
    '/evaluaciones/$evaluacionId/items/$itemId/respuesta',
    {'alternativaId': alternativaId},
    sinData: 'No pudimos guardar la respuesta. Inténtalo de nuevo.',
  );

  Future<EntregaEvaluacion> entregar(int evaluacionId) async =>
      EvaluacionConTiempoModelo.entrega(
        await publicarObjeto(
          _dio,
          '/evaluaciones/$evaluacionId/entregar',
          null,
          sinData: 'No recibimos la entrega. Inténtalo de nuevo.',
        ),
      );
}
