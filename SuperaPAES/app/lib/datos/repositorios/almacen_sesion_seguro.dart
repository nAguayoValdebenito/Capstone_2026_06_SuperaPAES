import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:supera_paes/datos/modelos/sesion_estudiante_modelo.dart';
import 'package:supera_paes/dominio/entidades/sesion_estudiante.dart';
import 'package:supera_paes/dominio/repositorios/almacen_sesion.dart';

/// Guarda la sesión cifrada con flutter_secure_storage: el almacén de claves
/// de Android y el llavero de iOS. En Android la app no se respalda
/// (`allowBackup="false"`), porque en otro teléfono la clave no se podría
/// descifrar.
class AlmacenSesionSeguro implements AlmacenSesion {
  const AlmacenSesionSeguro([this._almacen = const FlutterSecureStorage()]);

  final FlutterSecureStorage _almacen;

  static const String _clave = 'sesion_estudiante';

  @override
  Future<SesionEstudiante?> leer() async {
    try {
      final texto = await _almacen.read(key: _clave);
      if (texto == null) return null;
      final json = jsonDecode(texto);
      if (json is! Map<String, dynamic>) throw const FormatException();
      return SesionEstudianteModelo.fromJson(json).aEntidad();
    } on Object {
      // Ilegible (formato antiguo o clave del sistema que cambió): se
      // descarta y el estudiante vuelve a iniciar sesión.
      await borrar();
      return null;
    }
  }

  @override
  Future<void> guardar(SesionEstudiante sesion) => _almacen.write(
    key: _clave,
    value: jsonEncode(SesionEstudianteModelo.desdeEntidad(sesion).toJson()),
  );

  @override
  Future<void> borrar() async {
    try {
      await _almacen.delete(key: _clave);
    } on Object {
      // Si no se puede borrar, al leerla de nuevo se descarta igual.
    }
  }
}
