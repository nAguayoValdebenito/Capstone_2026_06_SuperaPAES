import 'package:supera_paes/dominio/entidades/perfil_estudiante.dart';
import 'package:supera_paes/nucleo/ids.dart';

/// Lee y arma el JSON del perfil (docs/contratos/HU-29.md): GET y PUT
/// /cuentas/perfil, POST /cuentas/perfil/confirmar-curso y GET
/// /temario/opciones-perfil.
abstract final class PerfilModelo {
  static List<int> _ids(Object? lista) => [
    for (final id in lista! as List<Object?>) leerId(id),
  ];

  static int? _idOpcional(Object? valor) =>
      valor == null ? null : leerId(valor);

  static Curso _curso(Map<String, dynamic> json) =>
      Curso(codigo: json['codigo'] as String, nombre: json['nombre'] as String);

  static PerfilEstudiante perfil(Map<String, dynamic> json) {
    final curso = json['curso'] as Map<String, dynamic>?;
    return PerfilEstudiante(
      completo: json['completo'] as bool,
      curso: curso == null ? null : _curso(curso),
      anioEgreso: json['anioEgreso'] as int?,
      pruebas: _ids(json['pruebas']),
      electivoId: _idOpcional(json['electivoId']),
      pruebaReforzarId: _idOpcional(json['pruebaReforzarId']),
      areasCarrera: _ids(json['areasCarrera']),
      debeConfirmarCurso: json['debeConfirmarCurso'] as bool,
    );
  }

  static OpcionesPerfil opciones(Map<String, dynamic> json) => OpcionesPerfil(
    cursos: [
      for (final curso in json['cursos'] as List<Object?>)
        _curso(curso! as Map<String, dynamic>),
    ],
    pruebas: [
      for (final prueba in json['pruebas'] as List<Object?>)
        _prueba(prueba! as Map<String, dynamic>),
    ],
    areasCarrera: [
      for (final area in json['areasCarrera'] as List<Object?>)
        _area(area! as Map<String, dynamic>),
    ],
  );

  static PruebaPerfil _prueba(Map<String, dynamic> json) => PruebaPerfil(
    id: leerId(json['id']),
    codigo: json['codigo'] as String,
    nombre: json['nombre'] as String,
    electivos: [
      for (final electivo in json['electivos'] as List<Object?>)
        _opcion(electivo! as Map<String, dynamic>),
    ],
  );

  static OpcionConNombre _opcion(Map<String, dynamic> json) =>
      (id: leerId(json['id']), nombre: json['nombre'] as String);

  static AreaCarrera _area(Map<String, dynamic> json) => AreaCarrera(
    id: leerId(json['id']),
    codigo: json['codigo'] as String,
    nombre: json['nombre'] as String,
    pruebasSugeridas: _ids(json['pruebasSugeridas']),
    electivoSugeridoId: _idOpcional(json['electivoSugeridoId']),
  );

  /// Cuerpo de PUT /cuentas/perfil.
  static Map<String, Object?> datos(DatosPerfil datos) => {
    ...curso(datos.curso, datos.anioEgreso),
    'pruebas': datos.pruebas,
    'electivoId': datos.electivoId,
    'pruebaReforzarId': datos.pruebaReforzarId,
    'areasCarrera': datos.areasCarrera,
  };

  /// El curso y, solo si egresó, el año de egreso.
  static Map<String, Object?> curso(String curso, int? anioEgreso) => {
    'curso': curso,
    'anioEgreso': ?anioEgreso,
  };
}
