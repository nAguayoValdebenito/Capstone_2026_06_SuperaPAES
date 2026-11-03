import 'package:dio/dio.dart';
import 'package:supera_paes/datos/modelos/practica_modelo.dart';
import 'package:supera_paes/dominio/entidades/evaluacion_abierta.dart';
import 'package:supera_paes/dominio/entidades/practica.dart';
import 'package:supera_paes/nucleo/respuesta_api.dart';

/// Llama a /api/v1/app/temario/opciones-practica y a las prácticas de
/// /api/v1/app/evaluaciones (HU-30). Recibe el cliente con sesión, que
/// agrega el token de acceso y lo renueva si venció.
class FuentePracticaRemota {
  const FuentePracticaRemota(this._dio);

  final Dio _dio;

  static const String _sinResumen =
      'No recibimos el resumen. Inténtalo de nuevo.';

  Future<OpcionesPractica> opciones(String curso) async =>
      PracticaModelo.opciones(
        await pedirObjeto(
          _dio,
          'GET',
          '/temario/opciones-practica',
          consulta: {'curso': curso},
          sinData: 'No recibimos las opciones de práctica. Inténtalo de nuevo.',
        ),
      );

  Future<PracticaIniciada> iniciar(DatosPractica datos) async =>
      PracticaModelo.iniciada(
        await publicarObjeto(
          _dio,
          '/evaluaciones/practicas',
          PracticaModelo.datos(datos),
          sinData: 'No recibimos la práctica. Inténtalo de nuevo.',
        ),
      );

  Future<PreguntaDePractica> siguiente(int practicaId) async =>
      PracticaModelo.pregunta(
        await publicarObjeto(
          _dio,
          '/evaluaciones/practicas/$practicaId/siguiente',
          null,
          sinData: 'No recibimos la pregunta. Inténtalo de nuevo.',
        ),
      );

  Future<Correccion> responder(
    int practicaId,
    int itemId,
    int alternativaId,
  ) async => PracticaModelo.correccion(
    await publicarObjeto(
      _dio,
      '/evaluaciones/$practicaId/items/$itemId/respuesta',
      {'alternativaId': alternativaId},
      sinData: 'No recibimos la corrección. Inténtalo de nuevo.',
    ),
  );

  Future<ResumenPractica> cerrar(int id) async => PracticaModelo.resumen(
    await publicarObjeto(
      _dio,
      '/evaluaciones/practicas/$id/cerrar',
      null,
      sinData: _sinResumen,
    ),
  );

  Future<ConsultaEvaluacionAbierta> evaluacionAbierta() async =>
      PracticaModelo.evaluacionAbierta(
        await pedirObjeto(
          _dio,
          'GET',
          '/evaluaciones/abierta',
          sinData: 'No recibimos la evaluación abierta. Inténtalo de nuevo.',
        ),
      );
}
