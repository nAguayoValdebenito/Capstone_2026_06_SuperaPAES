import 'package:dio/dio.dart';
import 'package:supera_paes/datos/modelos/practica_modelo.dart';
import 'package:supera_paes/dominio/entidades/practica.dart';
import 'package:supera_paes/nucleo/respuesta_api.dart';

/// Llama a /api/v1/app/temario/opciones-practica y a las prácticas de
/// /api/v1/app/evaluaciones (HU-30). Recibe el cliente con sesión, que
/// agrega el token de acceso y lo renueva si venció.
class FuentePracticaRemota {
  const FuentePracticaRemota(this._dio);

  final Dio _dio;

  static const String _sinResumen = 'La API respondió sin el resumen.';

  Future<OpcionesPractica> opciones(String curso) async =>
      PracticaModelo.opciones(
        await pedirObjeto(
          _dio,
          'GET',
          '/temario/opciones-practica',
          consulta: {'curso': curso},
          sinData: 'La API respondió sin las opciones de práctica.',
        ),
      );

  Future<PracticaIniciada> iniciar(DatosPractica datos) async =>
      PracticaModelo.iniciada(
        await publicarObjeto(
          _dio,
          '/evaluaciones/practicas',
          PracticaModelo.datos(datos),
          sinData: 'La API respondió sin la práctica.',
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
}
