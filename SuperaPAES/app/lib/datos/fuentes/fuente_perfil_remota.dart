import 'package:dio/dio.dart';
import 'package:supera_paes/datos/modelos/perfil_modelo.dart';
import 'package:supera_paes/dominio/entidades/perfil_estudiante.dart';
import 'package:supera_paes/nucleo/respuesta_api.dart';

/// Llama a /api/v1/app/cuentas/perfil y /api/v1/app/temario/opciones-perfil
/// (HU-29). Recibe el cliente con sesión, que agrega el token de acceso y lo
/// renueva si venció.
class FuentePerfilRemota {
  const FuentePerfilRemota(this._dio);

  final Dio _dio;

  static const String _sinPerfil = 'La API respondió sin el perfil.';

  Future<OpcionesPerfil> opciones() async => PerfilModelo.opciones(
    await pedirObjeto(
      _dio,
      'GET',
      '/temario/opciones-perfil',
      sinData: 'La API respondió sin las opciones del perfil.',
    ),
  );

  Future<PerfilEstudiante> obtener() async => PerfilModelo.perfil(
    await pedirObjeto(_dio, 'GET', '/cuentas/perfil', sinData: _sinPerfil),
  );

  Future<PerfilEstudiante> guardar(DatosPerfil datos) async =>
      PerfilModelo.perfil(
        await pedirObjeto(
          _dio,
          'PUT',
          '/cuentas/perfil',
          cuerpo: PerfilModelo.datos(datos),
          sinData: _sinPerfil,
        ),
      );

  Future<PerfilEstudiante> confirmarCurso(
    String curso,
    int? anioEgreso,
  ) async => PerfilModelo.perfil(
    await publicarObjeto(
      _dio,
      '/cuentas/perfil/confirmar-curso',
      PerfilModelo.curso(curso, anioEgreso),
      sinData: _sinPerfil,
    ),
  );
}
