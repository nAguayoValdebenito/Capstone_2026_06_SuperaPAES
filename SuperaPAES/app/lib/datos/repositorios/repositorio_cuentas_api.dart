import 'package:supera_paes/datos/fuentes/fuente_cuentas_remota.dart';
import 'package:supera_paes/dominio/entidades/datos_registro.dart';
import 'package:supera_paes/dominio/entidades/documento_legal.dart';
import 'package:supera_paes/dominio/entidades/sesion_estudiante.dart';
import 'package:supera_paes/dominio/repositorios/repositorio_cuentas.dart';

/// Implementación de [RepositorioCuentas] que consulta la API.
class RepositorioCuentasApi implements RepositorioCuentas {
  const RepositorioCuentasApi(this._fuente);

  final FuenteCuentasRemota _fuente;

  @override
  Future<List<DocumentoLegal>> documentosVigentes() async => [
    for (final modelo in await _fuente.documentosVigentes()) ?modelo.aEntidad(),
  ];

  @override
  Future<SesionEstudiante> registrar(DatosRegistro datos) async =>
      (await _fuente.registrar(datos)).aEntidad();

  @override
  Future<SesionEstudiante> ingresar({
    required String correo,
    required String contrasena,
    String? dispositivo,
  }) async => (await _fuente.ingresar(
    correo: correo,
    contrasena: contrasena,
    dispositivo: dispositivo,
  )).aEntidad();

  @override
  Future<TokensSesion> renovar(String tokenRenovacion) =>
      _fuente.renovar(tokenRenovacion);

  @override
  Future<void> cerrar(String tokenRenovacion) =>
      _fuente.cerrar(tokenRenovacion);
}
